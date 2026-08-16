import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";
import { getSupabaseServerClient } from "@/lib/supabase";
import { sendNdrWhatsApp } from "@/lib/whatsapp-notify";
import { sendReviewRequestEmail } from "@/lib/email";

// Broad keyword match rather than an exact status list — Shiprocket's status
// strings vary by courier partner, and catching a superset (with occasional
// false positives) is a much smaller cost than silently missing a real NDR
// and losing the one window to save the delivery before RTO.
const NDR_KEYWORDS = /ndr|undeliver|delivery fail|delivery attempt|not available|consignee/i;
const DELIVERED_KEYWORDS = /delivered/i;

/**
 * Shiprocket calls this on every shipment status change (Settings -> API ->
 * Webhooks in their dashboard), so the dashboard's shipment status updates
 * live instead of needing a manual "Refresh Tracking" click — and on the
 * transition into a failed-delivery (NDR) status, fires an automatic
 * WhatsApp nudge to the customer, since that's the actual window to save a
 * delivery before Shiprocket gives up and sends it back (RTO). On the
 * transition into delivered, fires the review-request email.
 *
 * Payload field names below follow Shiprocket's documented webhook shape,
 * but — like the Meta/MSG91 integrations earlier — this hasn't been
 * exercised against a real delivered webhook yet. Logs the raw body on
 * anything unrecognized so the first live event is easy to diagnose rather
 * than silently dropped. Always returns 200 quickly so Shiprocket doesn't
 * retry-storm on a downstream hiccup.
 */
export async function POST(request: Request) {
  const expectedToken = await getSetting("SHIPROCKET_WEBHOOK_TOKEN");
  const providedToken = request.headers.get("x-api-key");
  if (expectedToken && providedToken !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: true });

  // Shiprocket echoes back whatever we sent as `order_id` when the shipment
  // was created — that's our own orders.id (see createShiprocketOrder in
  // lib/shiprocket.ts), so it's the most reliable match. Fall back to AWB
  // or their internal shipment id if the order_id field isn't present.
  const ourOrderId = body.order_id ?? body.channel_order_id ?? null;
  const awbCode = body.awb ?? body.awb_code ?? null;
  const shipmentId = body.shipment_id ? String(body.shipment_id) : null;
  const status = body.current_status ?? body.shipment_status ?? body.status ?? null;
  const courierName = body.courier_name ?? null;

  if (!status || (!ourOrderId && !awbCode && !shipmentId)) {
    console.error("Shiprocket webhook: unrecognized payload shape", JSON.stringify(body));
    return NextResponse.json({ ok: true });
  }

  try {
    const supabase = getSupabaseServerClient();

    let lookup = supabase
      .from("orders")
      .select("id, customer_name, customer_phone, customer_email, shipment_status, review_requested_at");
    if (ourOrderId) lookup = lookup.eq("id", ourOrderId);
    else if (shipmentId) lookup = lookup.eq("shiprocket_shipment_id", shipmentId);
    else lookup = lookup.eq("shiprocket_awb_code", awbCode);
    const { data: existing } = await lookup.maybeSingle();

    if (!existing) {
      console.error("Shiprocket webhook: no matching order for", { ourOrderId, awbCode, shipmentId });
      return NextResponse.json({ ok: true });
    }

    const newStatus = String(status).toLowerCase();
    const wasNdr = NDR_KEYWORDS.test(existing.shipment_status ?? "");
    const isNdr = NDR_KEYWORDS.test(newStatus);
    // "undelivered" contains "delivered" as a substring — NDR must win that check.
    const wasDelivered = !wasNdr && DELIVERED_KEYWORDS.test(existing.shipment_status ?? "");
    const isDelivered = !isNdr && DELIVERED_KEYWORDS.test(newStatus);

    const patch: Record<string, string> = { shipment_status: newStatus };
    if (awbCode) patch.shiprocket_awb_code = awbCode;
    if (courierName) patch.courier_name = courierName;
    await supabase.from("orders").update(patch).eq("id", existing.id);

    // Only on the transition into NDR, not on every webhook hit while
    // already in that status — a retried/duplicate webhook for the same
    // failed attempt must never spam the customer repeatedly.
    if (isNdr && !wasNdr && existing.customer_phone) {
      await sendNdrWhatsApp({
        id: existing.id,
        customer_name: existing.customer_name,
        customer_phone: existing.customer_phone,
        total: 0,
      });
    }

    // Same transition-only guard, plus review_requested_at as a second
    // safety net in case a delivered->something->delivered flip ever
    // happens on a courier's side — never send the review ask twice.
    if (isDelivered && !wasDelivered && !existing.review_requested_at && existing.customer_email) {
      const { data: items } = await supabase
        .from("order_items")
        .select("chapter_name")
        .eq("order_id", existing.id);
      const chapterNames = [...new Set((items ?? []).map((i) => i.chapter_name))];
      if (chapterNames.length > 0) {
        const sent = await sendReviewRequestEmail(
          existing.customer_email,
          existing.customer_name,
          existing.id,
          chapterNames
        );
        if (sent) {
          await supabase
            .from("orders")
            .update({ review_requested_at: new Date().toISOString() })
            .eq("id", existing.id);
        }
      }
    }
  } catch (err) {
    console.error("Shiprocket webhook handling failed", err);
  }

  return NextResponse.json({ ok: true });
}
