import crypto from "crypto";
import { getSetting } from "@/lib/settings";
import { getSupabaseServerClient } from "@/lib/supabase";
import { renderWelcomeBack15Email } from "@/lib/email-templates/welcomeback15";

export const WELCOMEBACK15 = {
  key: "welcomeback15",
  couponCode: "WELCOMEBACK15",
  subject: "Your next story is 15% off (24 hours only)",
  offerHours: 24,
};

// Brevo's free plan shares one 300/day allowance between campaigns and the
// order/invoice emails — always leave this many for transactional mail.
const TRANSACTIONAL_RESERVE = 40;
const MAX_BATCH = 250;

export function unsubscribeToken(email: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "travaholic";
  return crypto.createHmac("sha256", secret).update(email.toLowerCase()).digest("hex").slice(0, 24);
}

function unsubscribeUrl(email: string) {
  return `https://www.travaholic.in/api/unsubscribe?e=${encodeURIComponent(email)}&t=${unsubscribeToken(email)}`;
}

async function brevoCreditsLeft(apiKey: string) {
  const res = await fetch("https://api.brevo.com/v3/account", { headers: { "api-key": apiKey } });
  if (!res.ok) return 0;
  const data = await res.json();
  const plan = (data.plan ?? []).find((p: { creditsType?: string }) => p.creditsType === "sendLimit") ?? data.plan?.[0];
  return Number(plan?.credits ?? 0);
}

/**
 * Sends the next batch of the win-back campaign 1:1 (Brevo transactional,
 * tagged for open/click stats), highest-value past customers first, until
 * every legacy customer with an email has had it. Each batch extends the
 * coupon so every recipient gets a real 24 hours from their own send.
 */
export async function sendWelcomeBack15Batch() {
  const apiKey = await getSetting("BREVO_API_KEY");
  if (!apiKey) return { sent: 0, remaining: null, note: "BREVO_API_KEY not set" };
  const supabase = getSupabaseServerClient();

  const [{ data: customers }, { data: already }, { data: unsubs }] = await Promise.all([
    supabase
      .from("legacy_customers")
      .select("email, name, total_delivered_orders, last_order_at")
      .not("email", "is", null)
      .order("total_delivered_orders", { ascending: false })
      .order("last_order_at", { ascending: false, nullsFirst: false })
      .limit(5000),
    supabase.from("email_campaign_sends").select("email").eq("campaign", WELCOMEBACK15.key).limit(10000),
    supabase.from("email_unsubscribes").select("email").limit(10000),
  ]);
  const skip = new Set([...(already ?? []), ...(unsubs ?? [])].map((r) => r.email.toLowerCase()));
  const seen = new Set<string>();
  const queue = (customers ?? []).filter((c) => {
    const e = String(c.email).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) || skip.has(e) || seen.has(e)) return false;
    seen.add(e);
    return true;
  });
  if (queue.length === 0) return { sent: 0, remaining: 0, note: "campaign complete" };

  const credits = await brevoCreditsLeft(apiKey);
  const batchSize = Math.min(MAX_BATCH, Math.max(0, credits - TRANSACTIONAL_RESERVE), queue.length);
  if (batchSize === 0) return { sent: 0, remaining: queue.length, note: `only ${credits} Brevo credits left today` };

  const offerEndsAt = new Date(Date.now() + WELCOMEBACK15.offerHours * 3600 * 1000);
  const endsLabel =
    offerEndsAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }) + " IST";
  // Never shorten a window already promised to an earlier batch.
  const { data: coupon } = await supabase.from("coupon_codes").select("expires_at").eq("code", WELCOMEBACK15.couponCode).maybeSingle();
  if (!coupon?.expires_at || new Date(coupon.expires_at) < offerEndsAt) {
    await supabase.from("coupon_codes").update({ expires_at: offerEndsAt.toISOString(), active: true }).eq("code", WELCOMEBACK15.couponCode);
  }

  let sent = 0;
  for (const c of queue.slice(0, batchSize)) {
    const email = String(c.email).trim().toLowerCase();
    const unsub = unsubscribeUrl(email);
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { name: "Travaholic", email: "orders@travaholic.in" },
        replyTo: { email: "travaholiccaps@gmail.com" },
        to: [{ email, ...(c.name ? { name: String(c.name) } : {}) }],
        subject: WELCOMEBACK15.subject,
        htmlContent: renderWelcomeBack15Email(endsLabel, unsub),
        tags: [WELCOMEBACK15.key],
        headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      }),
    });
    const data = await res.json().catch(() => null);
    await supabase.from("email_campaign_sends").upsert(
      {
        campaign: WELCOMEBACK15.key,
        email,
        name: c.name ?? null,
        status: res.ok ? "sent" : "failed",
        message_id: data?.messageId ?? null,
        offer_ends_at: offerEndsAt.toISOString(),
      },
      { onConflict: "campaign,email" }
    );
    if (res.ok) sent++;
    else if (res.status === 402 || res.status === 429) break; // out of credits / rate limited — resume next run
  }
  return { sent, remaining: queue.length - sent, note: `offer ends ${endsLabel}` };
}

/** Everything the admin dashboard shows for the campaign. */
export async function getWelcomeBack15Stats() {
  const supabase = getSupabaseServerClient();
  const apiKey = await getSetting("BREVO_API_KEY");
  const [{ count: sent }, { count: failed }, { count: audience }, { count: unsubscribed }, { data: orders }] = await Promise.all([
    supabase.from("email_campaign_sends").select("id", { count: "exact", head: true }).eq("campaign", WELCOMEBACK15.key).eq("status", "sent"),
    supabase.from("email_campaign_sends").select("id", { count: "exact", head: true }).eq("campaign", WELCOMEBACK15.key).eq("status", "failed"),
    supabase.from("legacy_customers").select("id", { count: "exact", head: true }).not("email", "is", null),
    supabase.from("email_unsubscribes").select("email", { count: "exact", head: true }),
    supabase
      .from("orders")
      .select("id, created_at, customer_name, delivery_city, total, payment_status, coupon_discount_amount")
      .eq("coupon_code_used", WELCOMEBACK15.couponCode)
      .order("created_at", { ascending: false }),
  ]);

  let brevo: { delivered: number; opens: number; uniqueOpens: number; clicks: number; uniqueClicks: number; hardBounces: number; softBounces: number } | null = null;
  if (apiKey) {
    const res = await fetch(
      `https://api.brevo.com/v3/smtp/statistics/aggregatedReport?tag=${WELCOMEBACK15.key}&days=30`,
      { headers: { "api-key": apiKey }, cache: "no-store" }
    );
    if (res.ok) brevo = await res.json();
  }

  const paid = (orders ?? []).filter((o) => o.payment_status === "paid");
  return {
    audience: audience ?? 0,
    sent: sent ?? 0,
    failed: failed ?? 0,
    unsubscribed: unsubscribed ?? 0,
    brevo,
    orders: orders ?? [],
    paidOrders: paid.length,
    revenue: paid.reduce((s, o) => s + Number(o.total ?? 0), 0),
    discountGiven: paid.reduce((s, o) => s + Number(o.coupon_discount_amount ?? 0), 0),
  };
}
