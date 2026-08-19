import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { postToInstagramFeed, postToInstagramCarouselFeed } from "@/lib/instagram";

/** Publishes an ad brief's copy/image straight to Instagram as an organic feed post — no ad spend, no Meta campaign created. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const supabase = getSupabaseServerClient();
    const { data: brief } = await supabase.from("ad_briefs").select("*").eq("id", body.id).maybeSingle();
    if (!brief) return NextResponse.json({ error: "Brief not found" }, { status: 404 });
    if (brief.posted_at) {
      return NextResponse.json({ error: "This brief has already been posted" }, { status: 400 });
    }

    const caption =
      brief.hashtags && brief.hashtags.length > 0
        ? `${brief.primary_text}\n\n${brief.hashtags.map((h: string) => `#${h.replace(/^#/, "")}`).join(" ")}`
        : brief.primary_text;

    let postId: string;
    if (brief.is_carousel) {
      const images: string[] = (brief.image_urls ?? []).filter((url: string | null): url is string => !!url);
      if (images.length < 4) {
        return NextResponse.json({ error: "Generate or attach all 4 carousel images before posting" }, { status: 400 });
      }
      ({ postId } = await postToInstagramCarouselFeed(images, caption));
    } else {
      if (!brief.image_url) {
        return NextResponse.json({ error: "Generate or attach an image before posting" }, { status: 400 });
      }
      ({ postId } = await postToInstagramFeed(brief.image_url, caption));
    }

    const { error } = await supabase
      .from("ad_briefs")
      .update({ posted_at: new Date().toISOString(), instagram_post_id: postId })
      .eq("id", body.id);
    if (error) throw error;

    return NextResponse.json({ ok: true, postId });
  } catch (err) {
    console.error("Failed to post ad brief to Instagram", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not post to Instagram" },
      { status: 500 }
    );
  }
}
