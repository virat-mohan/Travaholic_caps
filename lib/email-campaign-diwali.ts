import { getSetting } from "@/lib/settings";
import { getSupabaseServerClient } from "@/lib/supabase";
import { voiceGate, stripHtml } from "@/lib/brand-voice";
import { renderDiwaliGiftEmail, diwaliSubject, type DiwaliSegment } from "@/lib/email-templates/diwaligift";
import { unsubscribeToken } from "@/lib/email-campaigns";

/**
 * Diwali gifting email (approved by Virat 5 Oct 2026).
 *   Segment "incomplete": people who left a cart or an unpaid order, minus anyone who has since paid.
 *   Segment "past": past customers (legacy_customers) never emailed by the win-back campaign.
 * One send per person ever (keyed by email across both segments), nobody
 * unsubscribed, nobody already emailed by any campaign in the last 20 hours
 * (so it never lands on the same day as the WELCOMEBACK15 resend). Off until
 * app_settings DIWALI_GIFT_ENABLED = "true" AND the GIFT10 coupon is live.
 */
export const DIWALI = {
  tag: "diwali_gifting_2026",
  keys: { past: "diwali_gifting_2026_past", incomplete: "diwali_gifting_2026_incomplete" } as Record<DiwaliSegment, string>,
  couponCode: "GIFT10",
  endsAt: new Date("2026-11-08T23:59:59+05:30"),
};

const TRANSACTIONAL_RESERVE = 40;
const MAX_BATCH = 250;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function firstName(name: unknown) {
  const first = String(name ?? "").trim().split(/\s+/)[0] ?? "";
  if (!/^[A-Za-z][A-Za-z'-]{1,20}$/.test(first)) return null;
  return first[0].toUpperCase() + first.slice(1).toLowerCase();
}

function unsubscribeUrl(email: string) {
  return `https://www.travaholic.in/api/unsubscribe?e=${encodeURIComponent(email)}&t=${unsubscribeToken(email)}`;
}

/** PostgREST caps a single response at 1000 rows no matter the .limit(), so page explicitly. */
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await build(from, from + 999);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

export type DiwaliRecipient = { email: string; name: string | null; segment: DiwaliSegment };

/** Builds the full not-yet-sent audience, segment "incomplete" first, then "past". */
export async function buildDiwaliAudience() {
  const supabase = getSupabaseServerClient();
  const recentCutoff = new Date(Date.now() - 20 * 3600 * 1000).toISOString();

  const [legacy, carts, unpaid, paid, converted, unsubs, diwaliSent, recent] = await Promise.all([
    fetchAll<{ email: string; name: string | null }>((a, b) =>
      supabase.from("legacy_customers").select("email, name, total_delivered_orders").not("email", "is", null).order("total_delivered_orders", { ascending: false }).order("id").range(a, b)),
    fetchAll<{ customer_email: string; customer_name: string | null }>((a, b) =>
      supabase.from("cart_sessions").select("customer_email, customer_name").eq("status", "abandoned").not("customer_email", "is", null).order("id").range(a, b)),
    fetchAll<{ customer_email: string; customer_name: string | null }>((a, b) =>
      supabase.from("orders").select("customer_email, customer_name").neq("payment_status", "paid").not("customer_email", "is", null).order("id").range(a, b)),
    fetchAll<{ customer_email: string }>((a, b) =>
      supabase.from("orders").select("customer_email").eq("payment_status", "paid").not("customer_email", "is", null).order("id").range(a, b)),
    fetchAll<{ customer_email: string }>((a, b) =>
      supabase.from("cart_sessions").select("customer_email").eq("status", "converted").not("customer_email", "is", null).order("id").range(a, b)),
    fetchAll<{ email: string }>((a, b) => supabase.from("email_unsubscribes").select("email").order("email").range(a, b)),
    fetchAll<{ email: string }>((a, b) =>
      supabase.from("email_campaign_sends").select("email").in("campaign", Object.values(DIWALI.keys)).order("id").range(a, b)),
    fetchAll<{ email: string }>((a, b) =>
      supabase.from("email_campaign_sends").select("email").gte("sent_at", recentCutoff).order("id").range(a, b)),
  ]);

  const norm = (e: string) => e.trim().toLowerCase();
  const wb = await fetchAll<{ email: string }>((a, b) =>
    supabase.from("email_campaign_sends").select("email").in("campaign", ["welcomeback15", "welcomeback15_resend"]).order("id").range(a, b));
  const wbSent = new Set(wb.map((r) => norm(r.email)));

  const blocked = new Set<string>([
    ...unsubs.map((r) => norm(r.email)),
    ...diwaliSent.map((r) => norm(r.email)),
    ...recent.map((r) => norm(r.email)),
    ...paid.map((r) => norm(r.customer_email)),
    ...converted.map((r) => norm(r.customer_email)),
  ]);

  const seen = new Set<string>();
  const out: DiwaliRecipient[] = [];
  const add = (rawEmail: string, name: string | null, segment: DiwaliSegment, requireNeverWinback: boolean) => {
    const email = norm(rawEmail);
    if (!EMAIL_RE.test(email) || blocked.has(email) || seen.has(email)) return;
    if (requireNeverWinback && wbSent.has(email)) return;
    seen.add(email);
    out.push({ email, name, segment });
  };
  // Incomplete purchases first (warmest). They may already have had a win-back mail; that is fine for them.
  for (const r of [...carts.map((c) => ({ e: c.customer_email, n: c.customer_name })), ...unpaid.map((o) => ({ e: o.customer_email, n: o.customer_name }))]) add(r.e, r.n, "incomplete", false);
  // Past customers: only those the win-back campaign never reached.
  for (const r of legacy) add(r.email, r.name, "past", true);
  return out;
}

async function brevoCreditsLeft(apiKey: string) {
  const res = await fetch("https://api.brevo.com/v3/account", { headers: { "api-key": apiKey } });
  if (!res.ok) return 0;
  const data = await res.json();
  const plan = (data.plan ?? []).find((p: { creditsType?: string }) => p.creditsType === "sendLimit") ?? data.plan?.[0];
  return Number(plan?.credits ?? 0);
}

function gate(segment: DiwaliSegment) {
  return voiceGate(`${diwaliSubject(segment, null)}\n${stripHtml(renderDiwaliGiftEmail(segment, "https://www.travaholic.in"))}`, "email", "Diwali gifting campaign");
}

export async function sendDiwaliGiftBatch() {
  if ((await getSetting("DIWALI_GIFT_ENABLED")) !== "true") return { sent: 0, remaining: null, note: "disabled (DIWALI_GIFT_ENABLED is not true)" };
  if (Date.now() > DIWALI.endsAt.getTime()) return { sent: 0, remaining: 0, note: "campaign over (after 8 Nov)" };
  const apiKey = await getSetting("BREVO_API_KEY");
  if (!apiKey) return { sent: 0, remaining: null, note: "BREVO_API_KEY not set" };
  const supabase = getSupabaseServerClient();

  // Never email about a code that is not live.
  const { data: coupon } = await supabase.from("coupon_codes").select("active, expires_at").eq("code", DIWALI.couponCode).maybeSingle();
  if (!coupon?.active || !coupon.expires_at || new Date(coupon.expires_at) <= new Date()) return { sent: 0, remaining: null, note: "GIFT10 is not live" };

  for (const seg of ["past", "incomplete"] as DiwaliSegment[]) {
    const v = gate(seg);
    if (!v.ok) return { sent: 0, remaining: null, note: v.reason ?? "brand voice block" };
  }

  const queue = await buildDiwaliAudience();
  if (queue.length === 0) return { sent: 0, remaining: 0, note: "nobody left to email today" };
  const credits = await brevoCreditsLeft(apiKey);
  const batchSize = Math.min(MAX_BATCH, Math.max(0, credits - TRANSACTIONAL_RESERVE), queue.length);
  if (batchSize === 0) return { sent: 0, remaining: queue.length, note: `only ${credits} Brevo credits left today` };

  const bySegment = { past: 0, incomplete: 0 };
  let sent = 0;
  for (const c of queue.slice(0, batchSize)) {
    const unsub = unsubscribeUrl(c.email);
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { name: "Travaholic", email: "orders@travaholic.in" },
        replyTo: { email: "travaholiccaps@gmail.com" },
        to: [{ email: c.email, ...(c.name ? { name: String(c.name) } : {}) }],
        subject: diwaliSubject(c.segment, firstName(c.name)),
        htmlContent: renderDiwaliGiftEmail(c.segment, unsub),
        tags: [DIWALI.tag, DIWALI.keys[c.segment]],
        headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      }),
    });
    const data = await res.json().catch(() => null);
    await supabase.from("email_campaign_sends").upsert(
      { campaign: DIWALI.keys[c.segment], email: c.email, name: c.name ?? null, status: res.ok ? "sent" : "failed", message_id: data?.messageId ?? null, offer_ends_at: DIWALI.endsAt.toISOString() },
      { onConflict: "campaign,email" }
    );
    if (res.ok) {
      sent++;
      bySegment[c.segment]++;
    } else if (res.status === 402 || res.status === 429) break;
  }
  return { sent, bySegment, remaining: queue.length - sent, note: "diwali gifting" };
}
