import { getSetting, setSetting } from "@/lib/settings";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getRazorpayCredentials } from "@/lib/razorpay";
import { sendEmail, ORDER_NOTIFICATION_RECIPIENTS } from "@/lib/email";
import { sendWhatsAppSessionMessage } from "@/lib/msg91";

// Thresholds for "money is leaking at the payment step". Tuned for ~1–5
// orders/day: any one of these is abnormal enough to wake someone up.
const FAILED_PAYMENTS_24H = 3;
const MIN_ATTEMPTS_FOR_RATE = 4;
const MIN_SUCCESS_RATE = 0.5;
const CHECKOUTS_WITHOUT_SALE_48H = 5;
const ALERT_COOLDOWN_MS = 6 * 3600 * 1000;

export type CheckoutHealth = {
  ok: boolean;
  problems: string[];
  attempts24h: number;
  failed24h: number;
  captured24h: number;
  checkouts48h: number;
  paidOrders48h: number;
};

async function listRecentPayments(sinceSec: number) {
  const creds = await getRazorpayCredentials();
  if (!creds) return null;
  const auth = "Basic " + Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString("base64");
  const res = await fetch(`https://api.razorpay.com/v1/payments?from=${sinceSec}&count=100`, {
    headers: { Authorization: auth },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return (data.items ?? []) as { status: string; error_reason?: string | null }[];
}

/**
 * The payment step is the one place a silent failure costs real sales while
 * ads keep spending — 18 of 29 UPI attempts timed out over Aug–Sep 2026 and
 * nobody knew. Checks Razorpay's own record plus checkout starts vs paid
 * orders, and alerts the team (email + WhatsApp) when anything looks off.
 */
export async function getCheckoutHealth(): Promise<CheckoutHealth> {
  const now = Date.now();
  const payments = (await listRecentPayments(Math.floor((now - 24 * 3600 * 1000) / 1000))) ?? [];
  const failed24h = payments.filter((p) => p.status === "failed").length;
  const captured24h = payments.filter((p) => p.status === "captured" || p.status === "authorized").length;
  const attempts24h = failed24h + captured24h;

  const supabase = getSupabaseServerClient();
  const since48 = new Date(now - 48 * 3600 * 1000).toISOString();
  const [{ count: checkouts48h }, { count: paidOrders48h }] = await Promise.all([
    supabase
      .from("cart_sessions")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since48)
      .not("customer_phone", "is", null),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since48)
      .eq("payment_status", "paid"),
  ]);

  const problems: string[] = [];
  if (failed24h >= FAILED_PAYMENTS_24H) {
    problems.push(`${failed24h} failed payments in the last 24h (${captured24h} succeeded).`);
  }
  if (attempts24h >= MIN_ATTEMPTS_FOR_RATE && captured24h / attempts24h < MIN_SUCCESS_RATE) {
    problems.push(`Payment success rate ${Math.round((captured24h / attempts24h) * 100)}% over ${attempts24h} attempts.`);
  }
  if ((checkouts48h ?? 0) >= CHECKOUTS_WITHOUT_SALE_48H && (paidOrders48h ?? 0) === 0) {
    problems.push(`${checkouts48h} checkouts started in 48h with zero paid orders.`);
  }

  return {
    ok: problems.length === 0,
    problems,
    attempts24h,
    failed24h,
    captured24h,
    checkouts48h: checkouts48h ?? 0,
    paidOrders48h: paidOrders48h ?? 0,
  };
}

/** Runs the check and alerts (at most once per 6h) if the payment step is leaking. */
export async function runCheckoutHealthCheck(trigger: string) {
  const health = await getCheckoutHealth();
  if (health.ok) return health;

  const last = Number((await getSetting("CHECKOUT_HEALTH_LAST_ALERT")) ?? 0);
  if (Date.now() - last < ALERT_COOLDOWN_MS) return health;
  await setSetting("CHECKOUT_HEALTH_LAST_ALERT", String(Date.now()));

  const text = [
    "🚨 Travaholic checkout alert",
    ...health.problems.map((p) => `• ${p}`),
    "",
    "Check Razorpay → Payments for error reasons, and test checkout on a phone. Customers who failed can be sent a payment link from /admin/orders.",
    `(trigger: ${trigger})`,
  ].join("\n");

  const html = `<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#1a1a1a;white-space:pre-line">${text}</div>`;
  await Promise.allSettled(
    ORDER_NOTIFICATION_RECIPIENTS.map((to) => sendEmail(to, "🚨 Checkout alert — payments failing", html))
  );
  const wa = await getSetting("PM_ALERT_WHATSAPP");
  if (wa) await sendWhatsAppSessionMessage(wa, text);
  return health;
}
