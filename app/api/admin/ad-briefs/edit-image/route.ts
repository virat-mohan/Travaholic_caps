import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { generateAdImage } from "@/lib/image-gen";
import { chapters, chapterImageSrc } from "@/lib/chapters";

/**
 * Re-runs image generation off a free-text edit instruction ("make the sky
 * more orange", "put it against Atlas Mountains") — i.e. an image-to-image
 * edit, not a from-scratch regeneration off the original ad-brief prompt.
 *
 * The reference image for product fidelity is always ground truth —
 * reference_image_url if one was explicitly set (a real photo picked via
 * "Use Real Photo", for a generic/brand brief with no chapter), else the
 * chapter's real original product photo — deliberately NOT the current
 * generated/attached image. Chaining edits off the previous AI output lets
 * drift compound: if one edit ever wanders from the real product (a bad
 * generation, a stale asset from before a fix), every edit after it
 * "faithfully" preserves that wrong image instead of the actual cap.
 * Anchoring every edit back to ground truth means an edit can only ever
 * change the scene/background, never lock in a hallucinated product.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.id || !body?.editInstruction) {
    return NextResponse.json({ error: "Missing id or editInstruction" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const { data: brief } = await supabase
      .from("ad_briefs")
      .select("chapter_slug, chapter_slugs, image_url, image_urls, reference_image_url, creative_format")
      .eq("id", body.id)
      .maybeSingle();
    if (!brief) return NextResponse.json({ error: "Brief not found" }, { status: 404 });

    const currentImageUrl =
      typeof body.slotIndex === "number" ? brief.image_urls?.[body.slotIndex] : brief.image_url;
    if (!currentImageUrl) {
      return NextResponse.json({ error: "There is no existing image to edit yet — generate one first" }, { status: 400 });
    }

    const slugForSlot =
      typeof body.slotIndex === "number" && brief.chapter_slugs
        ? brief.chapter_slugs[body.slotIndex]
        : brief.chapter_slug;
    const chapter = chapters.find((c) => c.slug === slugForSlot);
    const chapterProductPhoto = chapter ? chapterImageSrc(chapter.folder, chapter.primary) : undefined;
    // Priority: an explicitly-set real-photo reference > the chapter's real
    // product photo > (no known ground truth at all, e.g. a from-scratch AI
    // brief with no chapter and no attached real photo) the current image.
    const groundTruth = brief.reference_image_url ?? chapterProductPhoto ?? currentImageUrl;
    const referenceImageUrl = groundTruth.startsWith("/") ? new URL(groundTruth, request.url).toString() : groundTruth;

    const imageUrl = await generateAdImage({
      prompt: body.editInstruction,
      referenceImageUrl,
      storagePathPrefix: "generated",
      aspectRatio: brief.creative_format === "story" ? "portrait" : "square",
    });

    // Re-reading image_urls HERE (right before the write), rather than
    // reusing the row fetched before the slow generateAdImage call above,
    // avoids a lost-update race when two slots are edited/generated close
    // together — see generate-image/route.ts for the full story.
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
    console.error("Failed to edit ad image", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not edit image" },
      { status: 500 }
    );
  }
}
