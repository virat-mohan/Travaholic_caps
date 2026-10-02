import { getSetting, setSetting } from "@/lib/settings";
import { getMetaMarketingAuth, graphGet, getCampaignDailyBudgetRupees } from "@/lib/meta-marketing";
import { sendEmail, ORDER_NOTIFICATION_RECIPIENTS } from "@/lib/email";
import { sendWhatsAppSessionMessage } from "@/lib/msg91";

// Meta charges 18% GST on top of ad spend for Indian accounts — a ₹1,000
// prepaid top-up buys ~₹847 of ads. Every runway figure must include it.
const GST = 0.18;
const ALERT_BELOW_DAYS = 3;
const ALERT_COOLDOWN_MS = 12 * 3600 * 1000;

export type AdFunds = {
  availableBalance: number | null; // prepaid funds left, ₹ incl. what GST will take
  unbilled: number; // spend already run but not yet charged, ₹
  spendLimitRoom: number | null; // ₹ left under the account spending limit (null = no limit)
  dailyBudget: number | null;
  spendableAds: number | null; // ₹ of actual ad delivery still possible
  runwayDays: number | null;
};

/**
 * The real "how long can the ads keep running" number, from Meta's live
 * account data. Written after 29–30 Sep 2026: a ₹1,000 top-up was mostly
 * absorbed by GST and ~₹280 of unbilled earlier spend, and the account
 * spending limit had ~₹850 room — the ads went dark overnight while the
 * estimate given was "about 2 days".
 */
export async function getAdFunds(): Promise<AdFunds> {
  const auth = await getMetaMarketingAuth();
  const acct = await graphGet<{
    amount_spent?: string;
    spend_cap?: string;
    balance?: string;
    funding_source_details?: { display_string?: string };
  }>(auth.account, auth.accessToken, { fields: "amount_spent,spend_cap,balance,funding_source_details" });

  const display = acct.funding_source_details?.display_string ?? "";
  const m = display.match(/₹\s?([\d,]+(?:\.\d+)?)/);
  const availableBalance = m ? Number(m[1].replace(/,/g, "")) : null;
  const unbilled = Number(acct.balance ?? 0) / 100;
  const cap = Number(acct.spend_cap ?? 0);
  const spendLimitRoom = cap > 0 ? Math.max(0, (cap - Number(acct.amount_spent ?? 0)) / 100) : null;

  const campaignIds = JSON.parse((await getSetting("PM_MANAGED_CAMPAIGN_IDS")) ?? "[]") as string[];
  const dailyBudget = campaignIds[0] ? await getCampaignDailyBudgetRupees(campaignIds[0]).catch(() => null) : null;

  const fromBalance = availableBalance != null ? Math.max(0, availableBalance - unbilled) / (1 + GST) : null;
  const candidates = [fromBalance, spendLimitRoom].filter((v): v is number => v != null);
  const spendableAds = candidates.length ? Math.min(...candidates) : null;
  const runwayDays = spendableAds != null && dailyBudget ? spendableAds / dailyBudget : null;

  return { availableBalance, unbilled, spendLimitRoom, dailyBudget, spendableAds, runwayDays };
}

export function describeAdFunds(f: AdFunds) {
  const inr = (n: number | null) => (n == null ? "—" : `₹${Math.round(n).toLocaleString("en-IN")}`);
  return [
    `Available balance: ${inr(f.availableBalance)}${f.unbilled ? ` (of which ${inr(f.unbilled)} is earlier spend not yet charged)` : ""}`,
    `Spending-limit room: ${f.spendLimitRoom == null ? "no limit set" : inr(f.spendLimitRoom)}`,
    `Actual ad delivery left after 18% GST: ${inr(f.spendableAds)}`,
    `Daily budget: ${inr(f.dailyBudget)} → runway ${f.runwayDays == null ? "—" : `${f.runwayDays.toFixed(1)} days`}`,
  ].join("\n");
}

/** Alerts (email + WhatsApp, max every 12h) when ads have < 3 days of real runway left. */
export async function checkAdFundsAndAlert() {
  const funds = await getAdFunds();
  if (funds.runwayDays == null || funds.runwayDays >= ALERT_BELOW_DAYS) return funds;
  const last = Number((await getSetting("AD_FUNDS_ALERT_AT")) ?? 0);
  if (Date.now() - last < ALERT_COOLDOWN_MS) return funds;
  await setSetting("AD_FUNDS_ALERT_AT", String(Date.now()));

  const limitNote =
    funds.spendLimitRoom != null && funds.spendableAds === funds.spendLimitRoom
      ? "The account SPENDING LIMIT is the binding constraint — raise or remove it in Billing & payments → Payment settings."
      : "Add funds in Billing & payments. Remember ~18% of any top-up goes to GST.";
  const text = `⚠️ Travaholic ads: ${funds.runwayDays < 0.5 ? "about to stop" : `~${funds.runwayDays.toFixed(1)} days of spend left`}\n\n${describeAdFunds(funds)}\n\n${limitNote}\nhttps://business.facebook.com/billing_hub/accounts/details?asset_id=10200162541319062`;
  const html = `<div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;white-space:pre-line">${text}</div>`;
  await Promise.allSettled(ORDER_NOTIFICATION_RECIPIENTS.map((to) => sendEmail(to, "⚠️ Ad account running low — top up / raise limit", html, undefined, { internal: true })));
  const wa = await getSetting("PM_ALERT_WHATSAPP");
  if (wa) await sendWhatsAppSessionMessage(wa, text, undefined, { internal: true }).catch(() => null);
  return funds;
}
