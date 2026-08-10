import { chapters as staticChapters } from "@/lib/chapters";
import { getSupabaseServerClient } from "@/lib/supabase";
import type { Chapter } from "@/types/chapter";

type Override = { primary_image: string | null; price: number | null; story: string | null };

/**
 * Static 16 + anything added from /admin/add-chapter, with per-field edits
 * from /admin/edit-chapter applied. Server-only (uses the Supabase service
 * role client).
 */
export async function getAllChapters(): Promise<Chapter[]> {
  let dynamicChapters: Chapter[] = [];
  let overrides: Record<string, Override> = {};

  try {
    const supabase = getSupabaseServerClient();

    const [{ data: dynamicRows }, { data: overrideRows }] = await Promise.all([
      supabase.from("dynamic_chapters").select("*"),
      supabase.from("chapter_hero_overrides").select("chapter_slug, primary_image, price, story"),
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
      (overrideRows ?? []).map((r) => [
        r.chapter_slug,
        { primary_image: r.primary_image, price: r.price, story: r.story },
      ])
    );
  } catch (err) {
    console.error("getAllChapters: Supabase fetch failed, falling back to static list", err);
  }

  const merged = [...staticChapters, ...dynamicChapters];
  return merged.map((c) => {
    const o = overrides[c.slug];
    if (!o) return c;
    return {
      ...c,
      primary: o.primary_image ?? c.primary,
      price: o.price ?? c.price,
      story: o.story ?? c.story,
    };
  });
}

export async function getChapterBySlug(slug: string): Promise<Chapter | undefined> {
  const all = await getAllChapters();
  return all.find((c) => c.slug === slug);
}
