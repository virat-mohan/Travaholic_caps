import { getSupabaseServerClient } from "@/lib/supabase";
import { getRazorpayCredentials, getUpiQrPayment } from "@/lib/razorpay";
import { finalizeOrder, type OrderPayload } from "@/lib/order-fulfillment";

/**
 * Turns a paid rescue QR into a real order — same finalizeOrder path as a
 * normal checkout (order row, invoice, team notification, Shiprocket), so
 * nobody has to match a screenshot by hand. Safe to call repeatedly from
 * both the customer's polling tab and the qr_code.credited webhook:
 * finalizeOrder dedupes on the payment id.
 */
export async function finalizePaidUpiQr(qrId: string) {
  const qr = await getUpiQrPayment(qrId);
  if (!qr?.paymentId || !qr.razorpayOrderId) return { paid: false as const };

  const supabase = getSupabaseServerClient();
  const { data: pending } = await supabase
    .from("pending_orders")
    .select("payload")
    .eq("razorpay_order_id", qr.razorpayOrderId)
    .maybeSingle();
  if (!pending) {
    console.error("UPI QR paid but no pending_orders snapshot", qrId, qr.razorpayOrderId);
    return { paid: true as const, orderId: null };
  }
  const { orderId } = await finalizeOrder(pending.payload as OrderPayload, qr.razorpayOrderId, qr.paymentId);
  return { paid: true as const, orderId };
}

/**
 * Same idea for a Razorpay Payment Link sent to a customer whose checkout
 * payment failed (notes.razorpay_order_id points at their original
 * pending_orders snapshot). Called by the payment_link.paid webhook and by
 * the daily reconcile sweep, so a paid link always becomes a shipped order.
 */
export async function finalizePaidPaymentLink(razorpayOrderId: string, paymentId: string) {
  const supabase = getSupabaseServerClient();
  const { data: pending } = await supabase
    .from("pending_orders")
    .select("payload")
    .eq("razorpay_order_id", razorpayOrderId)
    .maybeSingle();
  if (!pending) {
    console.error("Payment link paid but no pending_orders snapshot", razorpayOrderId);
    return null;
  }
  return finalizeOrder(pending.payload as OrderPayload, razorpayOrderId, paymentId);
}

/** Daily safety sweep: any paid rescue payment link that never became an order does now. */
export async function reconcilePaidPaymentLinks() {
  const creds = await getRazorpayCredentials();
  if (!creds) return 0;
  const auth = `Basic ${Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString("base64")}`;
  const res = await fetch("https://api.razorpay.com/v1/payment_links?count=50", { headers: { Authorization: auth } });
  if (!res.ok) return 0;
  const links = ((await res.json()).payment_links ?? []) as {
    status: string;
    notes?: { razorpay_order_id?: string };
    payments?: { payment_id: string; status: string }[];
  }[];
  let done = 0;
  for (const link of links) {
    const orderId = link.notes?.razorpay_order_id;
    const paid = link.payments?.find((p) => p.status === "captured");
    if (link.status !== "paid" || !orderId || !paid) continue;
    const r = await finalizePaidPaymentLink(orderId, paid.payment_id);
    if (r && !r.alreadyExisted) done++;
  }
  return done;
}
