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
