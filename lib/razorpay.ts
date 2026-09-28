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

/**
 * Reads a payment's actual current state from Razorpay — used by the
 * dashboard's "Refresh from Razorpay" action to reconcile refund_status
 * against what really happened, rather than trusting only our own
 * after-the-fact assumptions from firing a refund/cancel call.
 */
export async function getRazorpayPaymentStatus(paymentId: string) {
  const creds = await getRazorpayCredentials();
  if (!creds) throw new Error("Razorpay is not configured yet — add keys in /admin/settings");

  const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString("base64")}`,
    },
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`Razorpay payment lookup failed: ${res.status} ${JSON.stringify(data)}`);
  }

  const refundedRupees = (data.amount_refunded as number) / 100;
  // Razorpay's own refund_status is "full" | "partial" | null — mapped onto
  // our existing refund_status vocabulary rather than introducing a third.
  const refundStatus =
    data.refund_status === "full" ? "refunded" : data.refund_status === "partial" ? "approved" : "none";

  return { paymentStatus: data.status as string, refundedRupees, refundStatus };
}

/**
 * Verifies a Razorpay webhook's signature against the raw request body —
 * this is a different secret and a different signing scheme (HMAC over the
 * whole body) than verifyRazorpaySignature's checkout-flow one (HMAC over
 * "order_id|payment_id"), so it's deliberately a separate function.
 */
export function verifyRazorpayWebhookSignature(rawBody: string, signature: string, webhookSecret: string) {
  const expected = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  return expected === signature;
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

function razorpayAuthHeader(creds: { keyId: string; keySecret: string }) {
  return `Basic ${Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString("base64")}`;
}

/**
 * One-time UPI QR for a checkout whose in-modal payment failed — fixed to
 * that order's exact amount and tagged with its razorpay order id, so a
 * scan-and-pay can be matched back to the pending_orders snapshot and
 * finalized (order row, invoice, Shiprocket) with no manual step.
 */
export async function createUpiQrForOrder(razorpayOrderId: string) {
  const creds = await getRazorpayCredentials();
  if (!creds) throw new Error("Razorpay is not configured yet");
  const auth = razorpayAuthHeader(creds);

  const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${razorpayOrderId}`, { headers: { Authorization: auth } });
  if (!orderRes.ok) throw new Error(`Razorpay order lookup failed: ${orderRes.status}`);
  const order = await orderRes.json();
  if (order.status === "paid") throw new Error("This order is already paid");

  const res = await fetch("https://api.razorpay.com/v1/payments/qr_codes", {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "upi_qr",
      name: "Travaholic",
      usage: "single_use",
      fixed_amount: true,
      payment_amount: order.amount,
      description: `Travaholic order ${razorpayOrderId}`,
      close_by: Math.floor(Date.now() / 1000) + 30 * 60,
      notes: { razorpay_order_id: razorpayOrderId },
    }),
  });
  if (!res.ok) throw new Error(`Razorpay QR creation failed: ${res.status} ${await res.text()}`);
  const qr = await res.json();
  return { qrId: qr.id as string, imageUrl: qr.image_url as string, amountRupees: order.amount / 100 };
}

/** The captured payment on a QR (if any) plus the order it was generated for. */
export async function getUpiQrPayment(qrId: string) {
  const creds = await getRazorpayCredentials();
  if (!creds) return null;
  const auth = razorpayAuthHeader(creds);
  const [qrRes, payRes] = await Promise.all([
    fetch(`https://api.razorpay.com/v1/payments/qr_codes/${qrId}`, { headers: { Authorization: auth } }),
    fetch(`https://api.razorpay.com/v1/payments/qr_codes/${qrId}/payments`, { headers: { Authorization: auth } }),
  ]);
  if (!qrRes.ok || !payRes.ok) return null;
  const qr = await qrRes.json();
  const payments = ((await payRes.json()).items ?? []) as { id: string; status: string }[];
  const paid = payments.find((p) => p.status === "captured");
  return {
    razorpayOrderId: (qr.notes?.razorpay_order_id as string | undefined) ?? null,
    paymentId: paid?.id ?? null,
  };
}
