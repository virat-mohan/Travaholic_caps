import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { createShiprocketOrder, assignShiprocketAwb, requestShiprocketPickup } from "@/lib/shiprocket";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const supabase = getSupabaseServerClient();
    const { data: order } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.shiprocket_shipment_id) {
      return NextResponse.json({ error: "This order already has a shipment" }, { status: 400 });
    }
    if (!order.delivery_city || !order.delivery_state || !order.delivery_pincode) {
      return NextResponse.json(
        { error: "Order is missing city/state/pincode — this order predates structured addresses" },
        { status: 400 }
      );
    }

    const { data: items } = await supabase
      .from("order_items")
      .select("chapter_slug, chapter_name, unit_price, quantity")
      .eq("order_id", id);

    const { shiprocketOrderId, shipmentId } = await createShiprocketOrder({
      orderId: order.id,
      createdAt: order.created_at,
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      customerEmail: order.customer_email,
      addressLine: order.delivery_address,
      city: order.delivery_city,
      state: order.delivery_state,
      pincode: order.delivery_pincode,
      paymentMethod: order.payment_type === "cod_advance" ? "COD" : "Prepaid",
      // For a COD-advance order, Shiprocket should only show the remaining
      // balance as collectible on delivery — the advance was already
      // charged online. Field mapping here is a best-effort read of
      // Shiprocket's API (sub_total drives the COD collectible amount);
      // worth confirming against what actually shows in Shiprocket's
      // dashboard on the first live COD-advance shipment.
      subtotal: order.payment_type === "cod_advance" ? order.balance_due : order.subtotal,
      total: order.total,
      items: (items ?? []).map((item) => ({
        name: item.chapter_name,
        sku: item.chapter_slug,
        quantity: item.quantity,
        price: item.unit_price,
      })),
    });

    const { error } = await supabase
      .from("orders")
      .update({
        shiprocket_order_id: shiprocketOrderId,
        shiprocket_shipment_id: shipmentId,
        shipment_status: "processing",
      })
      .eq("id", id);
    if (error) throw error;

    // Best-effort from here — the order is already safely created in
    // Shiprocket regardless of what happens next, so a courier-assignment
    // or pickup-request failure must never look like the whole "Ship"
    // action failed. Both steps can always be retried manually from
    // Shiprocket's own dashboard if they don't go through here.
    let awbCode: string | null = null;
    let courierName: string | null = null;
    let courierWarning: string | null = null;
    try {
      const assigned = await assignShiprocketAwb(shipmentId);
      awbCode = assigned.awbCode;
      courierName = assigned.courierName;
      if (awbCode) {
        await supabase
          .from("orders")
          .update({ shiprocket_awb_code: awbCode, courier_name: courierName })
          .eq("id", id);
        try {
          await requestShiprocketPickup(shipmentId);
        } catch (pickupErr) {
          console.error("Shiprocket pickup request failed", id, pickupErr);
          courierWarning = "Courier assigned, but the pickup request failed — schedule it from Shiprocket's dashboard.";
        }
      } else {
        courierWarning = "Order created, but no courier could be auto-assigned — assign one from Shiprocket's dashboard.";
      }
    } catch (awbErr) {
      console.error("Shiprocket AWB assignment failed", id, awbErr);
      courierWarning = "Order created in Shiprocket, but courier assignment failed — assign one from Shiprocket's dashboard.";
    }

    return NextResponse.json({ ok: true, shiprocketOrderId, shipmentId, awbCode, courierName, courierWarning });
  } catch (err) {
    console.error("Failed to create Shiprocket shipment", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not create shipment" },
      { status: 500 }
    );
  }
}
