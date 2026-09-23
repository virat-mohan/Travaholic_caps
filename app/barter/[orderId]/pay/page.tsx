import { redirect } from "next/navigation";

/**
 * Moonglasses reaches this page from a payment-link email sent by a
 * charge-sweep cron when a gift_first order misses its post-after-delivery
 * deadline (see barter_charge_deadline_at / barter_charge_link_sent_at in
 * supabase/schema.sql). That cron and its dunning flow were deliberately
 * NOT ported in this pass — see the port's report — so nothing ever links
 * here yet. Kept as a graceful redirect rather than a raw 404 in case a
 * stale/guessed link ever hits it, or a future pass wires the cron back up.
 */
export default async function BarterChargePage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  redirect(`/barter/${orderId}`);
}
