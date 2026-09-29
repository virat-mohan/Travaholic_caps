import { getSupabaseServerClient } from "@/lib/supabase";
import { getRazorpayCredentials } from "@/lib/razorpay";
import { finalizeOrder, type OrderPayload } from "@/lib/order-fulfillment";
import { sendEmail, ORDER_NOTIFICATION_RECIPIENTS } from "@/lib/email";

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

  if (recovered.length || problems.length) {
    const html = `<div style="font-family:Helvetica,Arial,sans-serif;font-size:14px">
      ${recovered.length ? `<p><b>Recovered ${recovered.length} paid order(s)</b> whose checkout never confirmed (customer paid, browser didn't return). Invoice, confirmation and shipping have now run:</p><ul>${recovered.map((r) => `<li>${r}</li>`).join("")}</ul>` : ""}
      ${problems.length ? `<p><b>Could not recover:</b></p><ul>${problems.map((r) => `<li>${r}</li>`).join("")}</ul>` : ""}
    </div>`;
    await Promise.allSettled(ORDER_NOTIFICATION_RECIPIENTS.map((to) => sendEmail(to, "Payment reconcile: paid orders recovered", html)));
  }
  return { checked, recovered, problems };
}
