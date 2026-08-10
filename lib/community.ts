import fs from "node:fs";
import path from "node:path";
import { getSupabaseServerClient } from "@/lib/supabase";

export type ExplorerPost = {
  /** Filename on disk under public/images/community. */
  file: string;
  src: string;
  /** Short on-brand caption/testimonial, written to fit the scene in the photo. No names. */
  testimonial: string;
  /** Chapter slug(s) worn in the photo — one per cap visible, most confident guess first. */
  chapterSlugs: string[];
};

/**
 * Per-photo testimonial, written to match what's actually happening in the shot.
 * Keyed by exact filename in public/images/community. Add an entry as each real
 * Explorer photo comes in — anything without one falls back to a generic line
 * so the grid never breaks.
 */
const CAPTIONS: Record<string, string> = {
  "Screenshot 2026-08-07 at 9.03.28 PM.png": "Golden hour on a city block, halfway through pulling a hoodie on — the cap doesn't come off either way.",
  "Screenshot 2026-08-07 at 9.03.41 PM.png": "Life jacket on, mist over the water — the kind of boat ride you keep the cap on for the whole way.",
  "Screenshot 2026-08-07 at 9.03.58 PM.png": "Two caps, one boat, drinks that came out of nowhere — this is what a good afternoon on the water looks like.",
  "Screenshot 2026-08-07 at 9.04.08 PM.png": "A lake, a floating palace, and a tiger patch a long way from any actual jungle.",
  "Screenshot 2026-08-07 at 9.04.24 PM.png": "Giraffes in the background, not remotely bothered — some mornings the safari just hands you the shot.",
  "Screenshot 2026-08-07 at 9.04.42 PM.png": "A pilgrimage to Anfield, scarf and all — some caps are made for football grounds, not trailheads.",
  "Screenshot 2026-08-07 at 9.04.53 PM.png": "A real tiger, resting in the grass just behind — the patch on the cap got a little too on the nose that day.",
  "Screenshot 2026-08-07 at 9.05.09 PM.png": "Glacial blue water, a mountain full of cloud, and not much reason to let go of each other.",
  "Screenshot 2026-08-07 at 9.05.35 PM.png": "Red suitcase, yellow cap, that specific kind of airport energy right before a trip actually starts.",
  "Screenshot 2026-08-07 at 9.06.05 PM.png": "Caps on, completely unbothered by whatever's happening in the foreground of this one.",
};

/**
 * Which Chapter(s) are being worn in each photo — one entry per cap visible.
 * Best-effort identification by patch + cap body colour.
 */
const CHAPTER_LINKS: Record<string, string[]> = {
  "Screenshot 2026-08-07 at 9.03.28 PM.png": ["travaholic-snow"],
  "Screenshot 2026-08-07 at 9.03.41 PM.png": ["travaholic-black"],
  "Screenshot 2026-08-07 at 9.03.58 PM.png": ["tropical-blue", "sunshine"],
  "Screenshot 2026-08-07 at 9.04.08 PM.png": ["junglee"],
  "Screenshot 2026-08-07 at 9.04.24 PM.png": ["junglee", "wildling"],
  "Screenshot 2026-08-07 at 9.04.42 PM.png": ["travaholic-orange"],
  "Screenshot 2026-08-07 at 9.04.53 PM.png": ["junglee"],
  "Screenshot 2026-08-07 at 9.05.09 PM.png": ["travaholic-sky", "travaholic-ocean"],
  "Screenshot 2026-08-07 at 9.05.35 PM.png": ["sunshine"],
  "Screenshot 2026-08-07 at 9.06.05 PM.png": ["city-slicker-black", "tropical-pink"],
};

function getStaticExplorerPosts(): ExplorerPost[] {
  const dir = path.join(process.cwd(), "public/images/community");
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .map((file) => ({
      file,
      src: `/images/community/${encodeURIComponent(file)}`,
      testimonial: CAPTIONS[file] ?? "Wearing the story, wherever the trip takes them next.",
      chapterSlugs: CHAPTER_LINKS[file] ?? [],
    }));
}

/**
 * Static filesystem photos plus admin-approved submissions from
 * /community/add-your-chapter. Falls back to the static list alone if
 * Supabase is unreachable, same pattern as getAllChapters().
 */
export async function getExplorerPosts(): Promise<ExplorerPost[]> {
  const staticPosts = getStaticExplorerPosts();

  try {
    const supabase = getSupabaseServerClient();
    const { data } = await supabase
      .from("explorer_submissions")
      .select("id, photo_url, testimonial, chapter_slugs")
      .eq("status", "approved")
      .order("created_at", { ascending: false });

    const approvedPosts: ExplorerPost[] = (data ?? []).map((row) => ({
      file: row.id,
      src: row.photo_url,
      testimonial: row.testimonial,
      chapterSlugs: row.chapter_slugs ?? [],
    }));

    return [...approvedPosts, ...staticPosts];
  } catch (err) {
    console.error("getExplorerPosts: Supabase fetch failed, falling back to static list", err);
    return staticPosts;
  }
}

export async function getExplorerPostsForChapter(slug: string): Promise<ExplorerPost[]> {
  return (await getExplorerPosts()).filter((p) => p.chapterSlugs.includes(slug));
}
