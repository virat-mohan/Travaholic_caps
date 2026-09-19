import { getSupabaseServerClient } from "@/lib/supabase";
import { getChapterSalesInRange } from "@/lib/sales-metrics";
import { generateAdBrief } from "@/lib/ad-brief";
import { chapters } from "@/lib/chapters";

const SELLING_FAST_UNITS = 5; // units in the trailing 7 days to count as "selling fast"
const COOLING_OFF_MIN_PRIOR_UNITS = 5; // prior week must have had real volume, not just noise
const COOLING_OFF_DROP_RATIO = 0.5; // this week's units must be ≤ half of the prior week's to count
const TRENDING_VIEWS_TOP_N = 2; // how many most-viewed chapters get a draft each sweep, at most
const TRENDING_VIEWS_MIN_VIEWS = 10; // floor so a quiet week doesn't draft off near-zero traffic

const SIGNAL_INSTRUCTIONS: Record<"selling_fast" | "cooling_off", string> = {
  selling_fast:
    "This product is genuinely selling fast this week — lean into real urgency and social proof (e.g. limited stock, high demand), not generic hype.",
  cooling_off:
    "Sales for this product have cooled off noticeably compared to last week — write a fresh re-engagement angle (a new use-case, a different emotional hook, a reminder) rather than urgency, since urgency won't ring true for a product that isn't currently in high demand.",
};

function trendingViewsInstructions(views: number, adViews: number) {
  const adLine =
    adViews > 0
      ? ` ${adViews} of those views came from people clicking a paid ad — the interest is real, not just a fluke.`
      : " Almost all of that interest is organic, not paid — people are finding this product on their own.";
  return (
    `This is one of the most-viewed products on the site this week (${views} product-page views) but hasn't ` +
    `been the subject of a fresh post recently — the automated half of "keep highlighting what's already ` +
    `getting attention." Lean into genuine popularity/social-proof ("this is what people keep coming back to look ` +
    `at") rather than urgency, since this signal is about sustained interest, not a stock-clearing push.${adLine}`
  );
}

/**
 * Drafts (never launches) an ad brief for any chapter whose weekly sales
 * just crossed a "selling fast" or "cooling off" threshold — the automated
 * half of "generate marketing based on sales." Stays a draft in
 * /admin/ad-briefs for one-tap human review; nothing here spends money or
 * posts anything on its own. Guarded against re-drafting the same
 * chapter+signal every day by checking for a recent auto-generated brief
 * first.
 */
export async function runSalesSignalBriefSweep() {
  const supabase = getSupabaseServerClient();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const [thisWeek, priorWeek] = await Promise.all([
    getChapterSalesInRange(weekAgo.toISOString(), now.toISOString()),
    getChapterSalesInRange(twoWeeksAgo.toISOString(), weekAgo.toISOString()),
  ]);
  const priorBySlug = new Map(priorWeek.map((s) => [s.chapterSlug, s]));

  const drafted: { chapterSlug: string; signal: string }[] = [];
  const skipped: { chapterSlug: string; signal: string; reason: string }[] = [];

  async function alreadyDraftedRecently(chapterSlug: string, signal: string) {
    const { data } = await supabase
      .from("ad_briefs")
      .select("id")
      .eq("chapter_slug", chapterSlug)
      .eq("sales_signal", signal)
      .eq("auto_generated", true)
      .gte("created_at", weekAgo.toISOString())
      .limit(1)
      .maybeSingle();
    return !!data;
  }

  async function draftBrief(
    chapterSlug: string,
    chapterName: string,
    signal: "selling_fast" | "cooling_off" | "trending_views",
    sales: { unitsSold: number; revenue: number },
    customInstructions: string
  ) {
    if (await alreadyDraftedRecently(chapterSlug, signal)) {
      skipped.push({ chapterSlug, signal, reason: "already drafted this week" });
      return;
    }
    try {
      const brief = await generateAdBrief(
        chapterName,
        { chapterSlug, chapterName, unitsSold: sales.unitsSold, revenue: sales.revenue },
        customInstructions,
        false
      );
      await supabase.from("ad_briefs").insert({
        chapter_slug: chapterSlug,
        headline: brief.headline,
        primary_text: brief.primaryText,
        cta: brief.cta,
        target_audience: brief.targetAudience,
        is_carousel: false,
        image_prompt: brief.imagePrompt,
        creative_style: brief.creativeStyle ?? "ai_photo",
        overlay_text: brief.overlayText || null,
        hashtags: brief.hashtags,
        auto_generated: true,
        sales_signal: signal,
      });
      drafted.push({ chapterSlug, signal });
    } catch (err) {
      skipped.push({ chapterSlug, signal, reason: err instanceof Error ? err.message : "generation failed" });
    }
  }

  const sellingFastSlugs = new Set<string>();
  for (const sale of thisWeek) {
    if (sale.unitsSold >= SELLING_FAST_UNITS) {
      sellingFastSlugs.add(sale.chapterSlug);
      await draftBrief(sale.chapterSlug, sale.chapterName, "selling_fast", sale, SIGNAL_INSTRUCTIONS.selling_fast);
      continue;
    }
    const prior = priorBySlug.get(sale.chapterSlug);
    if (
      prior &&
      prior.unitsSold >= COOLING_OFF_MIN_PRIOR_UNITS &&
      sale.unitsSold <= prior.unitsSold * COOLING_OFF_DROP_RATIO
    ) {
      await draftBrief(sale.chapterSlug, sale.chapterName, "cooling_off", sale, SIGNAL_INSTRUCTIONS.cooling_off);
    }
  }

  // Third signal: keep highlighting whatever's actually getting looked at,
  // independent of whether it's converting to sales yet — real product-page
  // traffic (and specifically how much of it came from a paid ad click) is
  // its own kind of evidence that a product deserves another post, distinct
  // from the units-sold-driven signals above. Skips anything already
  // covered by selling_fast this run, so a product never gets two drafts
  // for what's really the same underlying popularity.
  const { data: viewEvents } = await supabase
    .from("tracking_events")
    .select("chapter_slug, ad_brief_id")
    .eq("event_name", "ViewContent")
    .gte("created_at", weekAgo.toISOString())
    .not("chapter_slug", "is", null);

  const viewCounts = new Map<string, number>();
  const adViewCounts = new Map<string, number>();
  for (const ev of viewEvents ?? []) {
    const slug = ev.chapter_slug as string;
    viewCounts.set(slug, (viewCounts.get(slug) ?? 0) + 1);
    if (ev.ad_brief_id) adViewCounts.set(slug, (adViewCounts.get(slug) ?? 0) + 1);
  }

  const topViewed = [...viewCounts.entries()]
    .filter(([slug, views]) => views >= TRENDING_VIEWS_MIN_VIEWS && !sellingFastSlugs.has(slug))
    .sort((a, b) => b[1] - a[1])
    .slice(0, TRENDING_VIEWS_TOP_N);

  for (const [slug, views] of topViewed) {
    const chapterName = chapters.find((c) => c.slug === slug)?.name ?? slug;
    const adViews = adViewCounts.get(slug) ?? 0;
    await draftBrief(slug, chapterName, "trending_views", { unitsSold: 0, revenue: 0 }, trendingViewsInstructions(views, adViews));
  }

  return { drafted, skipped };
}
