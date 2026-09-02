import { getSupabaseServerClient } from "@/lib/supabase";
import { computeWebsiteAnalytics } from "@/lib/website-analytics";
import { getRecentPostPerformance } from "@/lib/instagram";

export type Recommendation = {
  area: "ads" | "organic" | "whatsapp" | "traffic";
  summary: string;
  detail: string;
};

/**
 * A read-only pass across every channel already being tracked — ad
 * performance, WhatsApp send stats, first-party site analytics, and
 * organic Instagram engagement — producing plain-language suggestions.
 * Deliberately advisory only: unlike lib/ad-agent.ts (which is allowed to
 * pause/scale a campaign it already launched), nothing here takes any
 * action. A human reads these and decides.
 */
export async function generateGrowthRecommendations(): Promise<Recommendation[]> {
  const recs: Recommendation[] = [];
  const untilIso = new Date().toISOString();
  const sinceIso = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  // --- Site traffic & funnel signal ---
  try {
    const analytics = await computeWebsiteAnalytics(sinceIso, untilIso);
    const topViewed = analytics.topViewedChapters[0];
    const topAdded = analytics.topAddedChapters[0];
    if (topViewed && (!topAdded || topViewed.name !== topAdded.name)) {
      recs.push({
        area: "traffic",
        summary: `${topViewed.name} gets looked at the most but isn't converting to cart adds`,
        detail: `${topViewed.views} product views in the last 14 days, but it's not your top add-to-cart chapter (${topAdded ? topAdded.name : "none yet"} is). Worth checking its price, photos, or description against what's actually converting.`,
      });
    }
    const bestSource = analytics.trafficSources[0];
    if (bestSource && analytics.sessions > 20) {
      recs.push({
        area: "traffic",
        summary: `${bestSource.source} is your biggest traffic source right now`,
        detail: `${bestSource.sessions} of ${analytics.sessions} sessions in the last 14 days came from ${bestSource.source}. If that's an organic/free channel, it's worth a paid push there before spreading budget elsewhere.`,
      });
    }
    if (analytics.cartAbandonmentRate > 0.5 && analytics.funnel.addedToCart >= 5) {
      recs.push({
        area: "traffic",
        summary: `${Math.round(analytics.cartAbandonmentRate * 100)}% of carts are being abandoned`,
        detail: `${analytics.funnel.addedToCart} sessions added to cart in the last 14 days, but most never purchased. Worth checking the abandoned-cart WhatsApp/email nudge is actually enabled and firing.`,
      });
    }
  } catch (err) {
    console.error("Growth recommendations: website analytics failed", err);
  }

  // --- WhatsApp template performance ---
  try {
    const supabase = getSupabaseServerClient();
    const { data: messages } = await supabase
      .from("whatsapp_messages")
      .select("template_name, status, converted")
      .gte("created_at", sinceIso);
    const byTemplate = new Map<string, { sent: number; converted: number }>();
    for (const m of messages ?? []) {
      const row = byTemplate.get(m.template_name) ?? { sent: 0, converted: 0 };
      row.sent += 1;
      if (m.converted) row.converted += 1;
      byTemplate.set(m.template_name, row);
    }
    for (const [name, stats] of byTemplate) {
      if (stats.sent < 10) continue; // too small a sample to say anything useful
      const rate = stats.converted / stats.sent;
      if (rate >= 0.15) {
        recs.push({
          area: "whatsapp",
          summary: `"${name}" WhatsApp messages are converting well`,
          detail: `${stats.converted} of ${stats.sent} sent in the last 14 days led to a purchase (${Math.round(rate * 100)}%). Consider whether this messaging style fits other flows too.`,
        });
      } else if (rate === 0) {
        recs.push({
          area: "whatsapp",
          summary: `"${name}" WhatsApp messages aren't converting`,
          detail: `${stats.sent} sent in the last 14 days, 0 conversions. Worth reviewing the message copy or whether it's reaching the right audience.`,
        });
      }
    }
  } catch (err) {
    console.error("Growth recommendations: WhatsApp stats failed", err);
  }

  // --- Organic Instagram engagement ---
  try {
    const posts = await getRecentPostPerformance(12);
    const rated = posts.filter((p) => p.engagementRate !== null);
    if (rated.length > 0) {
      const avgRate = rated.reduce((sum, p) => sum + (p.engagementRate ?? 0), 0) / rated.length;
      const standouts = rated
        .filter((p) => (p.engagementRate ?? 0) >= avgRate * 1.5)
        .sort((a, b) => (b.engagementRate ?? 0) - (a.engagementRate ?? 0))
        .slice(0, 3);
      for (const post of standouts) {
        recs.push({
          area: "organic",
          summary: `An organic post is outperforming your average engagement`,
          detail: `${(post.caption ?? "(no caption)").slice(0, 80)} — ${Math.round((post.engagementRate ?? 0) * 100)}% engagement rate vs. an average of ${Math.round(avgRate * 100)}% across recent posts. This is a strong candidate to boost as a paid ad rather than drafting a new creative from scratch.${post.permalink ? ` ${post.permalink}` : ""}`,
        });
      }
    }
  } catch (err) {
    console.error("Growth recommendations: Instagram insights failed", err);
    recs.push({
      area: "organic",
      summary: "Couldn't check Instagram post performance",
      detail: "Instagram isn't configured, or the access token doesn't have insights permission yet — add META_ACCESS_TOKEN and INSTAGRAM_BUSINESS_ACCOUNT_ID in /admin/settings.",
    });
  }

  // --- Ad spend efficiency across all launched campaigns ---
  try {
    const supabase = getSupabaseServerClient();
    const { data: latestReport } = await supabase
      .from("weekly_reports")
      .select("ad_spend, roas, revenue")
      .order("week_end", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestReport && latestReport.ad_spend > 0) {
      if (latestReport.roas !== null && latestReport.roas < 1) {
        recs.push({
          area: "ads",
          summary: `Last week's ad spend lost money overall`,
          detail: `₹${latestReport.ad_spend} spent for ₹${latestReport.revenue} attributed revenue (${latestReport.roas.toFixed(2)}x ROAS). Check /admin/agent-log for which specific campaigns are dragging this down.`,
        });
      } else if (latestReport.roas !== null && latestReport.roas >= 3) {
        recs.push({
          area: "ads",
          summary: `Last week's ad spend is performing well — room to scale`,
          detail: `₹${latestReport.ad_spend} spent for ₹${latestReport.revenue} attributed revenue (${latestReport.roas.toFixed(2)}x ROAS). Worth increasing budget on whichever campaign is driving this, beyond what the automatic agent caps at.`,
        });
      }
    }
  } catch (err) {
    console.error("Growth recommendations: ad spend check failed", err);
  }

  return recs;
}
