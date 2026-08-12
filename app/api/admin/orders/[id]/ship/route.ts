import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { createShiprocketOrder } from "@/lib/shiprocket";

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
      paymentMethod: order.payment_status === "paid" ? "Prepaid" : "COD",
      subtotal: order.subtotal,
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

    return NextResponse.json({ ok: true, shiprocketOrderId, shipmentId });
  } catch (err) {
    console.error("Failed to create Shiprocket shipment", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not create shipment" },
      { status: 500 }
    );
  }
}
