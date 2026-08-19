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
    const { data: brief } = await supabase
      .from("ad_briefs")
      .select("chapter_slug, image_urls")
      .eq("id", body.id)
      .maybeSingle();

    const chapter = chapters.find((c) => c.slug === brief?.chapter_slug);
    const referenceImageUrl = chapter ? chapterImageSrc(chapter.folder, chapter.primary) : undefined;
    const absoluteReference =
      referenceImageUrl && referenceImageUrl.startsWith("/")
        ? new URL(referenceImageUrl, request.url).toString()
        : referenceImageUrl;

    const imageUrl = await generateAdImage({
      prompt: body.imagePrompt,
      referenceImageUrl: absoluteReference,
      storagePathPrefix: "generated",
    });

    // A carousel card (slotIndex present) writes into image_urls[slotIndex]
    // instead of the singular image_url — read-modify-write since Supabase
    // doesn't support a partial array-index update directly.
    if (typeof body.slotIndex === "number") {
      const current: (string | null)[] = Array.isArray(brief?.image_urls) ? [...brief.image_urls] : [];
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
