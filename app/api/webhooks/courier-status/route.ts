import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";
import { getSupabaseServerClient } from "@/lib/supabase";
import { sendNdrWhatsApp, sendRtoInitiatedWhatsApp, sendRtoRefundedWhatsApp } from "@/lib/whatsapp-notify";
import { sendReviewRequestEmail, sendRtoInitiatedEmail, sendRtoRefundedEmail } from "@/lib/email";
import { refundRazorpayPayment } from "@/lib/razorpay";

// Broad keyword match rather than an exact status list — Shiprocket's status
// strings vary by courier partner, and catching a superset (with occasional
// false positives) is a much smaller cost than silently missing a real NDR
// and losing the one window to save the delivery before RTO.
const NDR_KEYWORDS = /ndr|undeliver|delivery fail|delivery attempt|not available|consignee/i;
const DELIVERED_KEYWORDS = /delivered/i;
const RTO_KEYWORDS = /rto|return to origin|returned to origin/i;

async function logOrderEvent(orderId: string, eventType: string, detail?: string) {
  try {
    const supabase = getSupabaseServerClient();
    await supabase.from("order_events").insert({ order_id: orderId, event_type: eventType, detail: detail ?? null });
  } catch (err) {
    console.error("Failed to log order_events row", orderId, eventType, err);
  }
}

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
      .select(
        "id, customer_name, customer_phone, customer_email, shipment_status, review_requested_at, total, shipping_charge, refunded_amount, razorpay_payment_id, rto_notified_at, rto_processed_at"
      );
    if (ourOrderId) lookup = lookup.eq("id", ourOrderId);
    else if (shipmentId) lookup = lookup.eq("shiprocket_shipment_id", shipmentId);
    else lookup = lookup.eq("shiprocket_awb_code", awbCode);
    const { data: existing } = await lookup.maybeSingle();

    if (!existing) {
      console.error("Shiprocket webhook: no matching order for", { ourOrderId, awbCode, shipmentId });
      return NextResponse.json({ ok: true });
    }

    const newStatus = String(status).toLowerCase();
    const oldStatus = existing.shipment_status ?? "";

    // RTO must be checked first and excluded from the other two — "RTO
    // Delivered" contains "delivered" as a substring (would otherwise fire
    // the review-request email), and Shiprocket's RTO statuses don't overlap
    // NDR's keywords in practice, but checking order here still matters.
    const wasRto = RTO_KEYWORDS.test(oldStatus);
    const isRto = RTO_KEYWORDS.test(newStatus);
    // "RTO Initiated" / "RTO In Transit" vs the shipment actually being back —
    // refund/restock must only fire on the latter, not the moment RTO starts.
    const wasRtoDelivered = wasRto && DELIVERED_KEYWORDS.test(oldStatus);
    const isRtoDelivered = isRto && DELIVERED_KEYWORDS.test(newStatus);

    const wasNdr = !wasRto && NDR_KEYWORDS.test(oldStatus);
    const isNdr = !isRto && NDR_KEYWORDS.test(newStatus);
    // "undelivered" contains "delivered" as a substring — NDR must win that check.
    const wasDelivered = !wasRto && !wasNdr && DELIVERED_KEYWORDS.test(oldStatus);
    const isDelivered = !isRto && !isNdr && DELIVERED_KEYWORDS.test(newStatus);

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

    // RTO in transit — heads-up only, nothing financial yet since the item
    // hasn't physically come back. rto_notified_at is the transition guard
    // (mirrors review_requested_at's role for delivered).
    if (isRto && !isRtoDelivered && !wasRto && !existing.rto_notified_at) {
      if (existing.customer_phone) {
        await sendRtoInitiatedWhatsApp({
          id: existing.id,
          customer_name: existing.customer_name,
          customer_phone: existing.customer_phone,
          total: 0,
        });
      }
      if (existing.customer_email) {
        await sendRtoInitiatedEmail(existing.customer_email, existing.customer_name, existing.id);
      }
      await supabase.from("orders").update({ rto_notified_at: new Date().toISOString() }).eq("id", existing.id);
      await logOrderEvent(existing.id, "rto_initiated", newStatus);
    }

    // RTO actually delivered back — the one moment refund + restock fire,
    // guarded by rto_processed_at so a retried webhook can't double-refund
    // or double-restock. Shipping stays non-refundable (standard D2C
    // policy); refund failure (e.g. insufficient Razorpay balance — a real
    // case seen in this account) is logged but must never block the
    // restock, since the physical item being back is independent of
    // whether Razorpay could move money right now.
    if (isRtoDelivered && !wasRtoDelivered && !existing.rto_processed_at) {
      const refundRupees = Math.max(0, existing.total - (existing.shipping_charge ?? 0) - (existing.refunded_amount ?? 0));
      let refundedRupees = 0;

      if (refundRupees > 0 && existing.razorpay_payment_id) {
        try {
          const refund = await refundRazorpayPayment(existing.razorpay_payment_id, refundRupees);
          refundedRupees = refund.amountRupees;
          await supabase
            .from("orders")
            .update({
              refunded_amount: (existing.refunded_amount ?? 0) + refundedRupees,
              razorpay_refund_id: refund.refundId,
              refund_status: "refunded",
            })
            .eq("id", existing.id);
          await logOrderEvent(existing.id, "rto_refunded", `₹${refundedRupees} via ${refund.refundId}`);
        } catch (err) {
          console.error("RTO auto-refund failed", existing.id, err);
          await logOrderEvent(existing.id, "rto_refund_failed", err instanceof Error ? err.message : String(err));
        }
      }

      const { data: items } = await supabase
        .from("order_items")
        .select("chapter_slug, quantity")
        .eq("order_id", existing.id);
      for (const item of items ?? []) {
        const { data: inv } = await supabase
          .from("inventory")
          .select("stock_on_hand")
          .eq("chapter_slug", item.chapter_slug)
          .maybeSingle();
        if (inv) {
          await supabase
            .from("inventory")
            .update({ stock_on_hand: inv.stock_on_hand + item.quantity })
            .eq("chapter_slug", item.chapter_slug);
        }
      }
      await logOrderEvent(existing.id, "rto_restocked", (items ?? []).map((i) => `${i.chapter_slug} x${i.quantity}`).join(", "));

      await supabase.from("orders").update({ rto_processed_at: new Date().toISOString() }).eq("id", existing.id);

      if (refundedRupees > 0) {
        if (existing.customer_phone) {
          await sendRtoRefundedWhatsApp(
            { id: existing.id, customer_name: existing.customer_name, customer_phone: existing.customer_phone, total: 0 },
            refundedRupees
          );
        }
        if (existing.customer_email) {
          await sendRtoRefundedEmail(existing.customer_email, existing.customer_name, existing.id, refundedRupees);
        }
      }
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
