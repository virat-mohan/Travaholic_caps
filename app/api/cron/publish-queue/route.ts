import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";
import { getSupabaseServerClient } from "@/lib/supabase";
import { postBriefToInstagram } from "@/lib/ad-brief-publish";
import { launchCalendarBriefInManagedCampaign } from "@/lib/performance-manager";
import { getAdFunds } from "@/lib/ad-funds";

async function assertAuthorized(request: Request) {
  const secret = await getSetting("CRON_SECRET");
  if (!secret) return true;
  const provided = new URL(request.url).searchParams.get("secret") ?? request.headers.get("x-cron-secret");
  return provided === secret;
}

/** Sweeps ad_briefs queued for a future post/launch whose time has come. */
export async function GET(request: Request) {
  if (!(await assertAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  const { data: due, error } = await supabase
    .from("ad_briefs")
    .select("id, scheduled_action, ad_daily_budget_rupees, ad_cta_override, ad_age_min, ad_age_max, ad_gender")
    .eq("queue_status", "queued")
    .lte("scheduled_for", new Date().toISOString());
  if (error) {
    console.error("Failed to load queued ad briefs", error);
    return NextResponse.json({ error: "Could not load queue" }, { status: 500 });
  }

  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const brief of due ?? []) {
    try {
      if (brief.scheduled_action === "launch") {
        // A new ad set on a nearly empty account only starves the ad sets
        // that are already selling — wait (stay queued) until there are 3+
        // days of real ad money (after GST, unbilled spend, spending limit).
        const funds = await getAdFunds().catch(() => null);
        if (funds?.runwayDays != null && funds.runwayDays < 3) {
          await supabase
            .from("ad_briefs")
            .update({ queue_error: `Launch waiting for ad funds: ${funds.runwayDays.toFixed(1)} days of spend left (needs 3).` })
            .eq("id", brief.id);
          results.push({ id: brief.id, ok: false, error: "waiting for ad funds" });
          continue;
        }
        // Runs inside the Performance Manager's campaign (its budget cap and
        // ROAS rules), not as a separate campaign of its own.
        await launchCalendarBriefInManagedCampaign(brief.id);
      } else {
        await postBriefToInstagram(brief.id);
      }
      results.push({ id: brief.id, ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`Failed to publish queued brief ${brief.id}`, err);
      await supabase.from("ad_briefs").update({ queue_status: "failed", queue_error: message }).eq("id", brief.id);
      results.push({ id: brief.id, ok: false, error: message });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
