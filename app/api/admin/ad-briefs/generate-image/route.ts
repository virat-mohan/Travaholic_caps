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
      .select("chapter_slug")
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

    const { error } = await supabase
      .from("ad_briefs")
      .update({ image_url: imageUrl, image_source: "generated" })
      .eq("id", body.id);
    if (error) throw error;

    return NextResponse.json({ imageUrl });
  } catch (err) {
    console.error("Failed to generate ad image", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not generate image" },
      { status: 500 }
    );
  }
}
