import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { generateAdBrief } from "@/lib/ad-brief";
import { getRankedSignalCandidates } from "@/lib/sales-signal-briefs";
import { getTopSellingChapters } from "@/lib/sales-metrics";
import { chapters } from "@/lib/chapters";

const MAX_COUNT = 10;

// Generating N posts used to run strictly sequentially (one Claude call at
// a time), which for a batch of even 4-5 could take well past Vercel's
// default serverless timeout and come back as a non-JSON timeout page — a
// "JSON error" client-side, not the actual failure. Parallelized below to
// bound wall-clock time by the slowest single call instead of their sum;
// this maxDuration is a second layer of safety margin on top of that.
export const maxDuration = 60;

/**
 * On-demand version of the daily sales-signal sweep — an admin asks for N
 * posts right now (from /admin/ad-briefs), instead of waiting for whatever
 * the cron happens to surface. Ranks candidates the exact same way
 * (selling_fast > trending_views > cooling_off), then pads with top-selling
 * chapters overall if N is bigger than the number of real signals this
 * week, so asking for "10 posts" never comes back short. Ignores the
 * cron's weekly per-chapter/signal dedup guard on purpose — an explicit
 * human request for a batch right now should always produce that many
 * drafts, not silently skip chapters already covered once this week.
 * Alternates static/carousel for a visual mix, since a batch that's all one
 * format reads as repetitive in a content calendar. Every result lands as
 * a normal draft in /admin/ad-briefs — nothing here schedules, posts, or
 * spends money on its own.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const count = Math.min(MAX_COUNT, Math.max(1, Number(body?.count) || 0));
  if (!count) return NextResponse.json({ error: "Missing or invalid count" }, { status: 400 });

  try {
    const signalCandidates = await getRankedSignalCandidates();
    const usedSlugs = new Set(signalCandidates.map((c) => c.chapterSlug));

    type Candidate = {
      chapterSlug: string;
      chapterName: string;
      signal: "selling_fast" | "cooling_off" | "trending_views" | null;
      sales: { unitsSold: number; revenue: number };
      instructions?: string;
    };
    const pool: Candidate[] = signalCandidates.map((c) => ({
      chapterSlug: c.chapterSlug,
      chapterName: c.chapterName,
      signal: c.signal,
      sales: c.sales,
      instructions: c.instructions,
    }));

    if (pool.length < count) {
      const topSelling = await getTopSellingChapters(30);
      for (const sale of topSelling) {
        if (pool.length >= count) break;
        if (usedSlugs.has(sale.chapterSlug)) continue;
        pool.push({ chapterSlug: sale.chapterSlug, chapterName: sale.chapterName, signal: null, sales: sale });
        usedSlugs.add(sale.chapterSlug);
      }
    }
    // Still short (e.g. a brand-new store with no sales/view history yet) —
    // fill out with any chapter not already picked, cold-audience style.
    if (pool.length < count) {
      for (const chapter of chapters) {
        if (pool.length >= count) break;
        if (usedSlugs.has(chapter.slug)) continue;
        pool.push({ chapterSlug: chapter.slug, chapterName: chapter.name, signal: null, sales: { unitsSold: 0, revenue: 0 } });
        usedSlugs.add(chapter.slug);
      }
    }

    const picks = pool.slice(0, count);
    const supabase = getSupabaseServerClient();

    const results = await Promise.all(
      picks.map(async (c, i) => {
        const isCarousel = i % 2 === 1; // alternate static/carousel for a visual mix
        try {
          const brief = await generateAdBrief(
            c.chapterName,
            { chapterSlug: c.chapterSlug, chapterName: c.chapterName, unitsSold: c.sales.unitsSold, revenue: c.sales.revenue },
            c.instructions,
            isCarousel
          );
          const { data, error } = await supabase
            .from("ad_briefs")
            .insert({
              chapter_slug: c.chapterSlug,
              headline: brief.headline,
              primary_text: brief.primaryText,
              cta: brief.cta,
              target_audience: brief.targetAudience,
              is_carousel: isCarousel,
              image_prompt: isCarousel ? null : brief.imagePrompt,
              image_prompts: isCarousel ? (brief.imagePrompts ?? null) : null,
              creative_style: isCarousel ? null : (brief.creativeStyle ?? "ai_photo"),
              overlay_text: isCarousel ? null : (brief.overlayText || null),
              hashtags: brief.hashtags,
              auto_generated: true,
              sales_signal: c.signal,
              creative_format: isCarousel ? "carousel" : "static",
            })
            .select()
            .single();
          if (error) throw error;
          return { ok: true as const, chapterSlug: c.chapterSlug, id: data.id, headline: brief.headline, signal: c.signal };
        } catch (err) {
          return {
            ok: false as const,
            chapterSlug: c.chapterSlug,
            reason: err instanceof Error ? err.message : "generation failed",
          };
        }
      })
    );

    const created = results.filter((r) => r.ok).map((r) => ({ id: r.id, chapterSlug: r.chapterSlug, headline: r.headline, signal: r.signal }));
    const failed = results.filter((r) => !r.ok).map((r) => ({ chapterSlug: r.chapterSlug, reason: r.reason }));

    return NextResponse.json({ created, failed });
  } catch (err) {
    console.error("Failed to batch-generate ad briefs", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not batch-generate ad briefs" },
      { status: 500 }
    );
  }
}
