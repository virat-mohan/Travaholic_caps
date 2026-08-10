import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.chapterSlug) {
    return NextResponse.json({ error: "Missing chapterSlug" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();

    // Only overwrite the fields actually sent, so calling this from the hero
    // picker doesn't wipe out a price/story edit made separately (and vice versa).
    const { data: existing } = await supabase
      .from("chapter_hero_overrides")
      .select("primary_image, price, story")
      .eq("chapter_slug", body.chapterSlug)
      .maybeSingle();

    const { error } = await supabase.from("chapter_hero_overrides").upsert({
      chapter_slug: body.chapterSlug,
      primary_image: body.primaryImage ?? existing?.primary_image ?? null,
      price: body.price ?? existing?.price ?? null,
      story: body.story ?? existing?.story ?? null,
      updated_at: new Date().toISOString(),
    });

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to save chapter edit", err);
    return NextResponse.json({ error: "Could not save chapter edit" }, { status: 500 });
  }
}
