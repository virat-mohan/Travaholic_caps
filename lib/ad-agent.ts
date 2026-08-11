import { getSupabaseServerClient } from "@/lib/supabase";
import { getSetting } from "@/lib/settings";
import { getCampaignInsights } from "@/lib/meta-insights";
import {
  isCampaignActive,
  pauseCampaign,
  getAdSetDailyBudgetRupees,
  updateAdSetDailyBudgetRupees,
} from "@/lib/meta-ads";

const PAUSE_IF_SPEND_ABOVE_WITH_NO_CLICKS = 300;
const SCALE_IF_CLICKS_ABOVE = 20;
const BUDGET_INCREASE_FACTOR = 1.2;
const DEFAULT_MAX_BUDGET = 1000;

type AgentAction = {
  adBriefId: string;
  action: "paused" | "budget_increased" | "no_action";
  reason: string;
  beforeValue?: string;
  afterValue?: string;
};

async function logAction(action: AgentAction) {
  const supabase = getSupabaseServerClient();
  await supabase.from("agent_actions").insert({
    ad_brief_id: action.adBriefId,
    action: action.action,
    reason: action.reason,
    before_value: action.beforeValue ?? null,
    after_value: action.afterValue ?? null,
  });
}

/**
 * Runs one sweep over every launched ad brief and takes bounded, logged
 * actions on ones a human has already turned ACTIVE in Meta Ads Manager.
 *
 * Guardrails, deliberately conservative for a first version:
 * - Never activates a paused campaign — that decision stays human-only.
 * - Only pauses a campaign that's clearly not working (real spend, zero
 *   clicks) — never pauses on a hunch.
 * - Only scales budget up, never down automatically, and only up to
 *   AGENT_MAX_DAILY_BUDGET_RUPEES (or ₹1000/day if that's not set).
 * - Every decision — including "did nothing" — is logged to agent_actions
 *   with a reason, so the full history is auditable from /admin/agent-log.
 *
 * This uses clicks as the scaling signal rather than full ROAS because
 * order-to-campaign attribution isn't wired up yet (see the "fast follow"
 * note in the features doc) — treat early budget scaling as a coarse signal
 * and watch it closely until that's tightened up.
 */
export async function runAdAgentSweep() {
  const enabled = await getSetting("AGENT_ENABLED");
  if (enabled !== "true") {
    return { skipped: true as const, actions: [] as AgentAction[] };
  }

  const maxBudgetSetting = await getSetting("AGENT_MAX_DAILY_BUDGET_RUPEES");
  const maxBudget = maxBudgetSetting ? Number(maxBudgetSetting) : DEFAULT_MAX_BUDGET;

  const supabase = getSupabaseServerClient();
  const { data: briefs } = await supabase
    .from("ad_briefs")
    .select("id, meta_campaign_id, meta_adset_id, headline")
    .eq("status", "launched")
    .not("meta_campaign_id", "is", null);

  const actions: AgentAction[] = [];

  for (const brief of briefs ?? []) {
    if (!brief.meta_campaign_id || !brief.meta_adset_id) continue;

    try {
      const active = await isCampaignActive(brief.meta_campaign_id);
      if (!active) {
        const action: AgentAction = {
          adBriefId: brief.id,
          action: "no_action",
          reason: "Campaign is still PAUSED — waiting for a human to activate it.",
        };
        actions.push(action);
        await logAction(action);
        continue;
      }

      const insights = await getCampaignInsights(brief.meta_campaign_id, 3);

      if (insights.spend >= PAUSE_IF_SPEND_ABOVE_WITH_NO_CLICKS && insights.clicks === 0) {
        await pauseCampaign(brief.meta_campaign_id);
        const action: AgentAction = {
          adBriefId: brief.id,
          action: "paused",
          reason: `Spent ₹${insights.spend} over the last 3 days with zero clicks — creative or targeting isn't working.`,
          beforeValue: "ACTIVE",
          afterValue: "PAUSED",
        };
        actions.push(action);
        await logAction(action);
        continue;
      }

      if (insights.clicks >= SCALE_IF_CLICKS_ABOVE) {
        const currentBudget = await getAdSetDailyBudgetRupees(brief.meta_adset_id);
        const nextBudget = Math.min(Math.round(currentBudget * BUDGET_INCREASE_FACTOR), maxBudget);

        if (nextBudget > currentBudget) {
          await updateAdSetDailyBudgetRupees(brief.meta_adset_id, nextBudget);
          const action: AgentAction = {
            adBriefId: brief.id,
            action: "budget_increased",
            reason: `${insights.clicks} clicks over the last 3 days — scaling budget up (capped at ₹${maxBudget}/day).`,
            beforeValue: `₹${currentBudget}/day`,
            afterValue: `₹${nextBudget}/day`,
          };
          actions.push(action);
          await logAction(action);
          continue;
        }
      }

      const noAction: AgentAction = {
        adBriefId: brief.id,
        action: "no_action",
        reason: `${insights.clicks} clicks, ₹${insights.spend} spent over the last 3 days — not enough signal to act yet.`,
      };
      actions.push(noAction);
      await logAction(noAction);
    } catch (err) {
      console.error("Ad agent sweep failed for brief", brief.id, err);
    }
  }

  return { skipped: false as const, actions };
}
