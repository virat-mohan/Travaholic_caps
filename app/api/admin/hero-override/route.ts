import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.chapterSlug || !body?.primaryImage) {
    return NextResponse.json({ error: "Missing chapterSlug or primaryImage" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("chapter_hero_overrides").upsert({
      chapter_slug: body.chapterSlug,
      primary_image: body.primaryImage,
      updated_at: new Date().toISOString(),
    });

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to set hero override", err);
    return NextResponse.json({ error: "Could not set hero override" }, { status: 500 });
  }
}
