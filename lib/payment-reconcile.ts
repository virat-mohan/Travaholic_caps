import { getSupabaseServerClient } from "@/lib/supabase";
import { getRazorpayCredentials } from "@/lib/razorpay";
import { finalizeOrder, type OrderPayload } from "@/lib/order-fulfillment";
import { sendEmail, ORDER_NOTIFICATION_RECIPIENTS } from "@/lib/email";
import { finalizePaidUpiQr, reconcilePaidPaymentLinks } from "@/lib/upi-qr-fulfillment";
import { getSetting, setSetting } from "@/lib/settings";
import { checkAdFundsAndAlert } from "@/lib/ad-funds";

/**
 * The guarantee that a captured payment always becomes an order. Asks
 * Razorpay directly (no webhook needed) for captured payments in the last
 * `hours`, and finalizes any that have a checkout snapshot but no order —
 * same finalizeOrder path as a normal checkout (order row, invoice email,
 * team notification, Shiprocket). Idempotent on the payment id.
 *
 * Why it exists: on 29 Sep 2026 a ₹4,197 EMI payment was captured but the
 * browser never returned to /verify (EMI/redirect flows often don't), and
 * the webhook fallback was dead (no RAZORPAY_WEBHOOK_SECRET) — so the
 * customer paid and got nothing. Runs every few minutes via Supabase pg_cron.
 */
export async function reconcileCapturedPayments(hours = 72) {
  const creds = await getRazorpayCredentials();
  if (!creds) return { checked: 0, recovered: [] as string[], problems: ["Razorpay not configured"] };
  const auth = `Basic ${Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString("base64")}`;
  const from = Math.floor(Date.now() / 1000) - hours * 3600;
  const res = await fetch(`https://api.razorpay.com/v1/payments?from=${from}&count=100`, { headers: { Authorization: auth } });
  if (!res.ok) return { checked: 0, recovered: [], problems: [`Razorpay list failed: ${res.status}`] };
  const payments = ((await res.json()).items ?? []) as { id: string; status: string; order_id?: string; amount: number }[];

  const supabase = getSupabaseServerClient();
  const recovered: string[] = [];
  const problems: string[] = [];
  let checked = 0;
  for (const p of payments) {
    if (p.status !== "captured" || !p.order_id) continue;
    checked++;
    const { data: existing } = await supabase.from("orders").select("id").eq("razorpay_payment_id", p.id).maybeSingle();
    if (existing) continue;
    const { data: pending } = await supabase.from("pending_orders").select("payload").eq("razorpay_order_id", p.order_id).maybeSingle();
    if (!pending) {
      // Rescue payment links / QRs have their own finalizers; anything else is a real gap.
      continue;
    }
    try {
      const r = await finalizeOrder(pending.payload as OrderPayload, p.order_id, p.id);
      if (!r.alreadyExisted) recovered.push(`${r.orderId} (₹${p.amount / 100}, ${p.id})`);
    } catch (err) {
      problems.push(`${p.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Rescue UPI QRs (checkout fallback) — a paid QR whose tab was closed.
  try {
    const qrRes = await fetch(`https://api.razorpay.com/v1/payments/qr_codes?from=${from}&count=100`, { headers: { Authorization: auth } });
    if (qrRes.ok) {
      const qrs = ((await qrRes.json()).items ?? []) as { id: string; payments_count_received?: number; notes?: { razorpay_order_id?: string } }[];
      for (const qr of qrs) {
        if (!qr.notes?.razorpay_order_id || !qr.payments_count_received) continue;
        const r = await finalizePaidUpiQr(qr.id);
        if (r.paid && r.orderId) {
          const { data: o } = await supabase.from("orders").select("created_at").eq("id", r.orderId).maybeSingle();
          if (o && Date.now() - new Date(o.created_at).getTime() < 10 * 60 * 1000) recovered.push(`${r.orderId} (UPI QR ${qr.id})`);
        }
      }
    }
  } catch (err) {
    problems.push(`QR sweep: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Rescue payment links sent to customers whose checkout payment failed.
  try {
    const n = await reconcilePaidPaymentLinks();
    if (n > 0) recovered.push(`${n} order(s) from paid payment links`);
  } catch (err) {
    problems.push(`Payment-link sweep: ${err instanceof Error ? err.message : String(err)}`);
  }

  await checkWhatsAppSenderHasTemplates(problems);

  // Ad money runway (incl. GST + unbilled spend + spending limit) — hourly.
  const fundsAt = Number((await getSetting("AD_FUNDS_CHECKED_AT")) ?? 0);
  if (Date.now() - fundsAt > 3600 * 1000) {
    await setSetting("AD_FUNDS_CHECKED_AT", String(Date.now()));
    await checkAdFundsAndAlert().catch((err) => console.error("Ad funds check failed", err));
  }

  // Recoveries always alert; standing problems at most every 2h.
  let alertProblems = problems.length > 0;
  if (alertProblems && !recovered.length) {
    const last = Number((await getSetting("RECONCILE_PROBLEM_ALERT_AT")) ?? 0);
    if (Date.now() - last < 2 * 3600 * 1000) alertProblems = false;
    else await setSetting("RECONCILE_PROBLEM_ALERT_AT", String(Date.now()));
  }
  if (recovered.length || alertProblems) {
    const html = `<div style="font-family:Helvetica,Arial,sans-serif;font-size:14px">
      ${recovered.length ? `<p><b>Recovered ${recovered.length} paid order(s)</b> whose checkout never confirmed (customer paid, browser didn't return). Invoice, confirmation and shipping have now run:</p><ul>${recovered.map((r) => `<li>${r}</li>`).join("")}</ul>` : ""}
      ${problems.length ? `<p><b>Could not recover:</b></p><ul>${problems.map((r) => `<li>${r}</li>`).join("")}</ul>` : ""}
    </div>`;
    await Promise.allSettled(ORDER_NOTIFICATION_RECIPIENTS.map((to) => sendEmail(to, "Payment reconcile: paid orders recovered", html)));
  }
  return { checked, recovered, problems };
}

const REQUIRED_TEMPLATES = ["orderconfirmation", "shipnotification", "otpsend", "abandoned_cart_nudge"];

/**
 * 29 Sep 2026: the MSG91 sending number was switched to one with no approved
 * templates, and every automated WhatsApp (order confirmations, login codes)
 * silently stopped delivering. Re-verified whenever the configured number
 * changes (and hourly); a failure is surfaced in the reconcile alert email.
 */
async function checkWhatsAppSenderHasTemplates(problems: string[]) {
  const [number, authKey, lastOk, lastAt] = await Promise.all([
    getSetting("MSG91_WHATSAPP_INTEGRATED_NUMBER"),
    getSetting("MSG91_AUTH_KEY"),
    getSetting("WHATSAPP_SENDER_VERIFIED"),
    getSetting("WHATSAPP_SENDER_VERIFIED_AT"),
  ]);
  if (!number || !authKey) return;
  const digits = number.replace(/\D/g, "");
  const fresh = lastAt && Date.now() - Number(lastAt) < 60 * 60 * 1000;
  if (lastOk === digits && fresh) return;
  try {
    const res = await fetch(`https://control.msg91.com/api/v5/whatsapp/get-template-client/${digits}`, { headers: { authkey: authKey } });
    const data = await res.json();
    const approved = new Set(
      (Array.isArray(data?.data) ? data.data : [])
        .filter((t: { languages?: { status?: string }[] }) => t.languages?.some((l) => l.status === "approved"))
        .map((t: { name: string }) => t.name)
    );
    const missing = REQUIRED_TEMPLATES.filter((t) => !approved.has(t));
    if (missing.length) {
      problems.push(
        `WhatsApp sending number ${digits} is missing approved templates: ${missing.join(", ")} — order confirmations / login codes will NOT deliver. Switch MSG91_WHATSAPP_INTEGRATED_NUMBER back to a number with these templates (15553440937 has them) or get them approved on ${digits}.`
      );
      await setSetting("WHATSAPP_SENDER_VERIFIED", "");
    } else {
      await setSetting("WHATSAPP_SENDER_VERIFIED", digits);
      await setSetting("WHATSAPP_SENDER_VERIFIED_AT", String(Date.now()));
    }
  } catch {
    // MSG91 unreachable — try again next run rather than raising a false alarm.
  }
}
