import { chapters as staticChapters } from "@/lib/chapters";
import { getSupabaseServerClient } from "@/lib/supabase";
import type { Chapter } from "@/types/chapter";

/**
 * Static 16 + anything added from /admin/add-chapter, with hero-image
 * overrides applied. Server-only (uses the Supabase service role client).
 */
export async function getAllChapters(): Promise<Chapter[]> {
  let dynamicChapters: Chapter[] = [];
  let overrides: Record<string, string> = {};

  try {
    const supabase = getSupabaseServerClient();

    const [{ data: dynamicRows }, { data: overrideRows }] = await Promise.all([
      supabase.from("dynamic_chapters").select("*"),
      supabase.from("chapter_hero_overrides").select("chapter_slug, primary_image"),
    ]);

    dynamicChapters = (dynamicRows ?? []).map((row) => ({
      slug: row.slug,
      name: row.name,
      series: row.series,
      folder: "", // unused — dynamic chapters store full URLs in `images`/`primary`
      images: row.images,
      primary: row.primary_image,
      story: row.story,
      price: row.price,
      verifiedOnSite: row.verified_on_site,
    }));

    overrides = Object.fromEntries(
      (overrideRows ?? []).map((r) => [r.chapter_slug, r.primary_image])
    );
  } catch (err) {
    console.error("getAllChapters: Supabase fetch failed, falling back to static list", err);
  }

  const merged = [...staticChapters, ...dynamicChapters];
  return merged.map((c) => (overrides[c.slug] ? { ...c, primary: overrides[c.slug] } : c));
}

export async function getChapterBySlug(slug: string): Promise<Chapter | undefined> {
  const all = await getAllChapters();
  return all.find((c) => c.slug === slug);
}
