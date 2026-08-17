import crypto from "crypto";
import { getSetting } from "@/lib/settings";

export async function getRazorpayCredentials() {
  const [keyId, keySecret] = await Promise.all([
    getSetting("RAZORPAY_KEY_ID"),
    getSetting("RAZORPAY_KEY_SECRET"),
  ]);
  if (!keyId || !keySecret) return null;
  return { keyId, keySecret };
}

export async function createRazorpayOrder(amountInRupees: number, receipt: string) {
  const creds = await getRazorpayCredentials();
  if (!creds) throw new Error("Razorpay is not configured yet — add keys in /admin/settings");

  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Math.round(amountInRupees * 100),
      currency: "INR",
      receipt,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Razorpay order creation failed: ${res.status} ${text}`);
  }

  const order = await res.json();
  return { razorpayOrderId: order.id as string, keyId: creds.keyId };
}

/**
 * Refunds a payment via Razorpay's Refund API — this actually moves money
 * back to the customer's original payment method, not just a status label.
 * Omit amountInRupees for a full refund; pass a smaller amount for partial
 * (e.g. refunding a COD-advance order's advance only). Razorpay itself
 * enforces you can't refund more than what was actually captured, and
 * rejects a second full refund on an already-refunded payment — errors
 * from those cases surface as-is rather than being guessed at here.
 */
export async function refundRazorpayPayment(paymentId: string, amountInRupees?: number) {
  const creds = await getRazorpayCredentials();
  if (!creds) throw new Error("Razorpay is not configured yet — add keys in /admin/settings");

  const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      amountInRupees != null ? { amount: Math.round(amountInRupees * 100) } : {}
    ),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`Razorpay refund failed: ${res.status} ${JSON.stringify(data)}`);
  }
  return { refundId: data.id as string, status: data.status as string, amountRupees: (data.amount as number) / 100 };
}

export async function verifyRazorpaySignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string
) {
  const creds = await getRazorpayCredentials();
  if (!creds) throw new Error("Razorpay is not configured yet — add keys in /admin/settings");

  const expected = crypto
    .createHmac("sha256", creds.keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  return expected === razorpaySignature;
}
