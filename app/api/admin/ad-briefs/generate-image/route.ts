import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { generateAdImage } from "@/lib/image-gen";
import { chapters, chapterImageSrc } from "@/lib/chapters";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.id || !body?.imagePrompt) {
    return NextResponse.json({ error: "Missing id or imagePrompt" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    // Split from the reference_image_url read below — a missing column
    // there (migration not yet run) must never take down chapter_slug/
    // chapter_slugs too, since PostgREST fails a select entirely if any one
    // requested column doesn't exist, and this base data is what the
    // fallback path below needs to work at all.
    const { data: brief } = await supabase
      .from("ad_briefs")
      .select("chapter_slug, chapter_slugs, image_urls, creative_format")
      .eq("id", body.id)
      .maybeSingle();
    const { data: refRow } = await supabase
      .from("ad_briefs")
      .select("reference_image_url")
      .eq("id", body.id)
      .maybeSingle();

    // A multi-chapter carousel has a different product per card — use that
    // card's own chapter as the reference photo instead of the brief's
    // (nonexistent) single chapter_slug. An explicitly-set reference_image_url
    // (a real photo picked via "Use Real Photo") wins over the chapter photo
    // — it's a more specific, deliberate choice than the chapter default.
    const slugForSlot =
      typeof body.slotIndex === "number" && brief?.chapter_slugs
        ? brief.chapter_slugs[body.slotIndex]
        : brief?.chapter_slug;
    const chapter = chapters.find((c) => c.slug === slugForSlot);
    const chapterProductPhoto = chapter ? chapterImageSrc(chapter.folder, chapter.primary) : undefined;
    const referenceImageUrl = refRow?.reference_image_url ?? chapterProductPhoto;

    // Hard rule: never generate a product image with nothing real to anchor
    // it to — that's exactly how a fictional, wrong cap gets generated
    // instead of an actual Travaholic product. A genuinely product-less
    // brand/lifestyle post should use a real asset directly (no AI
    // generation involved) rather than this endpoint with no reference.
    if (!referenceImageUrl) {
      return NextResponse.json(
        {
          error:
            "No real product photo to anchor this generation to — pick a specific product for this post, or attach a real photo via \"Use Real Photo\" first, before generating.",
        },
        { status: 400 }
      );
    }

    const absoluteReference = referenceImageUrl.startsWith("/")
      ? new URL(referenceImageUrl, request.url).toString()
      : referenceImageUrl;

    const imageUrl = await generateAdImage({
      prompt: body.imagePrompt,
      referenceImageUrl: absoluteReference,
      storagePathPrefix: "generated",
      aspectRatio: brief?.creative_format === "story" ? "portrait" : "square",
    });

    // A carousel card (slotIndex present) writes into image_urls[slotIndex]
    // instead of the singular image_url — read-modify-write since Supabase
    // doesn't support a partial array-index update directly. Re-reading the
    // array HERE (right before the write) rather than reusing the row
    // fetched before the slow generateAdImage call above is what makes this
    // safe when two slots are generated close together: reusing the
    // pre-generation snapshot let a later-finishing request silently
    // overwrite an earlier one's slot with stale (missing) data for every
    // OTHER slot — exactly how a full carousel came back with only the
    // last-written slots filled in.
    if (typeof body.slotIndex === "number") {
      const { data: latest } = await supabase
        .from("ad_briefs")
        .select("image_urls")
        .eq("id", body.id)
        .maybeSingle();
      const current: (string | null)[] = Array.isArray(latest?.image_urls) ? [...latest.image_urls] : [];
      while (current.length < body.slotIndex + 1) current.push(null);
      current[body.slotIndex] = imageUrl;
      const { error } = await supabase
        .from("ad_briefs")
        .update({ image_urls: current, image_source: "generated" })
        .eq("id", body.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("ad_briefs")
        .update({ image_url: imageUrl, image_source: "generated" })
        .eq("id", body.id);
      if (error) throw error;
    }

    return NextResponse.json({ imageUrl });
  } catch (err) {
    console.error("Failed to generate ad image", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not generate image" },
      { status: 500 }
    );
  }
}
