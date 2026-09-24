import { getSupabaseServerClient } from "@/lib/supabase";
import { getSetting } from "@/lib/settings";
import {
  createShiprocketOrder,
  assignShiprocketAwb,
  requestShiprocketPickup,
  generateShiprocketLabel,
  findServiceableCourierId,
  getShiprocketOrderAwb,
} from "@/lib/shiprocket";
import { sendWarehouseNotificationEmail } from "@/lib/email";
import { buildAndUploadDuplicatedLabel } from "@/lib/label-print";
import { sendShipNotificationWhatsApp } from "@/lib/whatsapp-notify";

type OrderRow = Record<string, unknown> & {
  id: string;
  customer_name: string;
  customer_phone: string;
  total: number;
  delivery_pincode: string | null;
  payment_type: string | null;
  shiprocket_shipment_id: string | null;
  shiprocket_awb_code: string | null;
};
type ItemRow = { chapter_slug: string; chapter_name: string; unit_price: number; quantity: number };

/**
 * Everything that happens once a shipment has an AWB: pickup request, label,
 * warehouse email with the 2-up label sheet, and the "courier assigned"
 * WhatsApp. Shared by the first-time ship path and the stuck-AWB retry so an
 * order that needed a second attempt still gets exactly the same
 * notifications as one that worked first time — previously all of this was
 * nested inside the initial attempt, so a failed auto-assignment meant no
 * label and no WhatsApp ever, even after someone fixed it in Shiprocket.
 */
async function finalizeAssignedShipment(order: OrderRow, items: ItemRow[], shipmentId: string, awbCode: string, courierName: string | null) {
  const supabase = getSupabaseServerClient();
  let courierWarning: string | null = null;

  await supabase
    .from("orders")
    .update({ shiprocket_awb_code: awbCode, courier_name: courierName, shipment_status: "ready_to_ship" })
    .eq("id", order.id);

  try {
    await requestShiprocketPickup(shipmentId);
    await supabase.from("orders").update({ shipment_status: "pickup_pending" }).eq("id", order.id);
  } catch (pickupErr) {
    console.error("Shiprocket pickup request failed", order.id, pickupErr);
    courierWarning = "Courier assigned, but the pickup request failed — schedule it from Shiprocket's dashboard.";
  }

  try {
    const labelUrl = await generateShiprocketLabel(shipmentId);
    if (labelUrl) {
      await supabase.from("orders").update({ shiprocket_label_url: labelUrl }).eq("id", order.id);
    }
    const duplicatedLabelUrl = await buildAndUploadDuplicatedLabel(shipmentId, order.id);
    await sendWarehouseNotificationEmail(
      { ...order, shiprocket_awb_code: awbCode, courier_name: courierName } as unknown as Parameters<typeof sendWarehouseNotificationEmail>[0],
      items,
      duplicatedLabelUrl ?? labelUrl
    );
    const itemsLine = items.map((item) => `${item.quantity}x ${item.chapter_name}`).join(", ");
    await sendShipNotificationWhatsApp(order.id, order.customer_name, order.customer_phone, itemsLine, order.total);
  } catch (notifyErr) {
    console.error("Warehouse notification failed", order.id, notifyErr);
  }

  return courierWarning;
}

async function loadOrderAndItems(orderId: string) {
  const supabase = getSupabaseServerClient();
  const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!order) throw new Error("Order not found");
  const { data: items } = await supabase
    .from("order_items")
    .select("chapter_slug, chapter_name, unit_price, quantity")
    .eq("order_id", orderId);
  return { order: order as OrderRow, items: (items ?? []) as ItemRow[] };
}

/**
 * Creates the Shiprocket shipment for an order — courier assignment, pickup
 * request, label generation, and the warehouse invoice+label email, all in
 * one place. Shared by the manual "Ship" button in /admin/orders and
 * finalizeOrder's automatic call right after checkout.
 *
 * Only the initial Shiprocket-order creation is fatal (throws) — everything
 * after that is best-effort and can be retried with retryAwbAssignment.
 */
export async function shipOrder(orderId: string) {
  const supabase = getSupabaseServerClient();
  const { order, items } = await loadOrderAndItems(orderId);
  if (order.shiprocket_shipment_id) throw new Error("This order already has a shipment");
  if (!order.delivery_city || !order.delivery_state || !order.delivery_pincode) {
    throw new Error("Order is missing city/state/pincode — this order predates structured addresses");
  }

  const { shiprocketOrderId, shipmentId } = await createShiprocketOrder({
    orderId: order.id,
    createdAt: order.created_at as string,
    customerName: order.customer_name,
    customerPhone: order.customer_phone,
    customerEmail: order.customer_email as string,
    addressLine: order.delivery_address as string,
    city: order.delivery_city as string,
    state: order.delivery_state as string,
    pincode: order.delivery_pincode,
    paymentMethod: order.payment_type === "cod_advance" ? "COD" : "Prepaid",
    // For a COD-advance order, Shiprocket should only show the remaining
    // balance as collectible on delivery — the advance was already charged.
    subtotal: order.payment_type === "cod_advance" ? (order.balance_due as number) : (order.subtotal as number),
    total: order.total,
    items: items.map((item) => ({
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
    .eq("id", orderId);
  if (error) throw error;

  let awbCode: string | null = null;
  let courierName: string | null = null;
  let courierWarning: string | null = null;
  try {
    const assigned = await assignShiprocketAwb(shipmentId);
    awbCode = assigned.awbCode;
    courierName = assigned.courierName;
    if (awbCode) {
      courierWarning = await finalizeAssignedShipment(order, items, shipmentId, awbCode, courierName);
    } else {
      courierWarning = "Order created, but no courier could be auto-assigned — it will be retried automatically.";
    }
  } catch (awbErr) {
    console.error("Shiprocket AWB assignment failed", orderId, awbErr);
    courierWarning = `Order created in Shiprocket, but courier assignment failed (${awbErr instanceof Error ? awbErr.message : "unknown"}) — it will be retried automatically.`;
  }

  return { shiprocketOrderId, shipmentId, awbCode, courierName, courierWarning };
}

/**
 * Second attempt at courier assignment for an order whose Shiprocket
 * shipment exists but never got an AWB (shipment_status stuck on
 * "processing"). Tries Shiprocket's auto-pick first; if that fails, asks
 * serviceability for the cheapest courier that actually covers the lane and
 * assigns it explicitly — the auto-pick is what fails for remote pincodes.
 * On success runs the full post-AWB flow (pickup, label, warehouse email,
 * WhatsApp), exactly as a first-time success would.
 */
export async function retryAwbAssignment(orderId: string) {
  const { order, items } = await loadOrderAndItems(orderId);
  const shipmentId = order.shiprocket_shipment_id;
  if (!shipmentId) throw new Error("Order has no Shiprocket shipment yet — use Ship instead");
  if (order.shiprocket_awb_code) return { awbCode: order.shiprocket_awb_code, courierName: order.courier_name as string | null, retried: false };

  let awbCode: string | null = null;
  let courierName: string | null = null;
  let firstError: string | null = null;

  // Someone may already have assigned a courier in Shiprocket's own
  // dashboard — sync that rather than asking for a second one.
  if (order.shiprocket_order_id) {
    try {
      const existing = await getShiprocketOrderAwb(order.shiprocket_order_id as string);
      if (existing.awbCode) {
        awbCode = existing.awbCode;
        courierName = existing.courierName;
      }
    } catch (err) {
      console.error("Could not read existing Shiprocket AWB", orderId, err);
    }
  }

  if (!awbCode) {
    try {
      const assigned = await assignShiprocketAwb(shipmentId);
      awbCode = assigned.awbCode;
      courierName = assigned.courierName;
    } catch (err) {
      firstError = err instanceof Error ? err.message : "unknown";
    }
  }

  if (!awbCode && order.delivery_pincode) {
    const pickupPincode = await getSetting("SHIPROCKET_PICKUP_PINCODE");
    if (pickupPincode) {
      const courierId = await findServiceableCourierId(pickupPincode, order.delivery_pincode, order.payment_type === "cod_advance");
      if (courierId) {
        const assigned = await assignShiprocketAwb(shipmentId, courierId);
        awbCode = assigned.awbCode;
        courierName = assigned.courierName;
      }
    }
  }

  if (!awbCode) {
    throw new Error(firstError ?? "No courier serves this pincode right now — check the Shiprocket wallet balance and serviceability.");
  }

  const courierWarning = await finalizeAssignedShipment(order, items, shipmentId, awbCode, courierName);
  return { awbCode, courierName, retried: true, courierWarning };
}

/** Every order with a Shiprocket shipment but no AWB — the ones a failed auto-assignment left stranded. */
export async function retryAllStuckAwbs() {
  const supabase = getSupabaseServerClient();
  const { data: stuck } = await supabase
    .from("orders")
    .select("id, customer_name")
    .not("shiprocket_shipment_id", "is", null)
    .is("shiprocket_awb_code", null)
    .neq("status", "cancelled");
  const results: { orderId: string; customer: string; ok: boolean; detail: string }[] = [];
  for (const o of stuck ?? []) {
    try {
      const r = await retryAwbAssignment(o.id);
      results.push({ orderId: o.id, customer: o.customer_name, ok: true, detail: `${r.courierName ?? "courier"} ${r.awbCode}` });
    } catch (err) {
      results.push({ orderId: o.id, customer: o.customer_name, ok: false, detail: err instanceof Error ? err.message : "failed" });
    }
  }
  return results;
}
