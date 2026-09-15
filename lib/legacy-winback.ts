import { getSupabaseServerClient } from "@/lib/supabase";
import { sendLegacyWinbackWhatsApp } from "@/lib/whatsapp-notify";

const LEGACY_WINBACK_LINK = "https://travaholic.in/?utm_source=whatsapp&utm_campaign=winback_legacy";
const LEGACY_WINBACK_COUPON = "LOYAL10";

/**
 * One-time-per-customer win-back sweep over the imported past-customer list
 * (legacy_customers — orders placed before the current site existed, see
 * supabase/schema.sql). Only targets people with at least one delivered
 * order (total_delivered_orders > 0) — anyone whose only history is
 * cancelled/RTO'd was never actually a customer. winback_sent_at is a
 * permanent guard, not a cooldown: this list is static (one xlsx import),
 * so unlike the live-site sweep (lib/winback.ts) there's no new lapsing
 * customer to re-trigger on — running this twice must never double-message
 * the same phone number.
 */
export async function runLegacyWinbackSweep() {
  const supabase = getSupabaseServerClient();
  const { data: candidates, error } = await supabase
    .from("legacy_customers")
    .select("id, phone, name")
    .gt("total_delivered_orders", 0)
    .is("winback_sent_at", null);
  if (error) throw error;

  let sent = 0;
  let failed = 0;
  for (const customer of candidates ?? []) {
    const delivered = await sendLegacyWinbackWhatsApp(customer.phone, customer.name, LEGACY_WINBACK_COUPON, LEGACY_WINBACK_LINK);
    if (delivered) {
      await supabase.from("legacy_customers").update({ winback_sent_at: new Date().toISOString() }).eq("id", customer.id);
      sent++;
    } else {
      failed++;
    }
  }

  return { sent, failed, eligible: candidates?.length ?? 0 };
}
