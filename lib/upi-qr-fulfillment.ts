import { getSupabaseServerClient } from "@/lib/supabase";
import { getUpiQrPayment } from "@/lib/razorpay";
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
