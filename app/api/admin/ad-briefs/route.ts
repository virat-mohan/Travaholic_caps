import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { generateAdBrief } from "@/lib/ad-brief";
import { getTopSellingChapters } from "@/lib/sales-metrics";
import { chapters } from "@/lib/chapters";

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("ad_briefs")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ briefs: data ?? [] });
  } catch (err) {
    console.error("Failed to list ad briefs", err);
    return NextResponse.json({ briefs: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.chapterSlug) {
    return NextResponse.json({ error: "Missing chapterSlug" }, { status: 400 });
  }

  try {
    const chapter = chapters.find((c) => c.slug === body.chapterSlug);
    const chapterName = chapter?.name ?? body.chapterSlug;

    const sales = (await getTopSellingChapters(30)).find((s) => s.chapterSlug === body.chapterSlug);
    const brief = await generateAdBrief(chapterName, sales, body.customInstructions || undefined);

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("ad_briefs")
      .insert({
        chapter_slug: body.chapterSlug,
        headline: brief.headline,
        primary_text: brief.primaryText,
        cta: brief.cta,
        target_audience: brief.targetAudience,
        image_prompt: brief.imagePrompt,
        hashtags: brief.hashtags,
      })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ brief: data });
  } catch (err) {
    console.error("Failed to generate ad brief", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not generate ad brief" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const patch: Record<string, string | string[]> = {};
  if (body.headline != null) patch.headline = body.headline;
  if (body.primaryText != null) patch.primary_text = body.primaryText;
  if (body.cta != null) patch.cta = body.cta;
  if (body.targetAudience != null) patch.target_audience = body.targetAudience;
  if (body.hashtags != null) patch.hashtags = body.hashtags;
  if (body.imageUrl != null) patch.image_url = body.imageUrl;
  if (body.imageSource != null) patch.image_source = body.imageSource;
  if (body.status != null) patch.status = body.status;

  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("ad_briefs").update(patch).eq("id", body.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to update ad brief", err);
    return NextResponse.json({ error: "Could not update ad brief" }, { status: 500 });
  }
}
