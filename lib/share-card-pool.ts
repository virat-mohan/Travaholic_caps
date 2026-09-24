import { getAllChapters } from "@/lib/chapters-dynamic";
import { chapterImageSrc } from "@/lib/chapters";

export type ShareCardProduct = { imageUrl: string; productName: string };

function hashToIndex(seed: string, length: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return length > 0 ? hash % length : 0;
}

/**
 * Every live, verified Chapter — static or admin-added — feeds the Pay With
 * A Post share card, using the exact same side-profile shot the homepage
 * and series grids already show (chapterImageSrc handles both an on-disk
 * static filename and a full Storage URL for a dynamic Chapter). Unlike
 * Moonglasses (which only had real lifestyle photography for a hand-picked
 * subset of SKUs), every Travaholic Chapter has a real product shot, so
 * there's no need for a hardcoded allowlist here — the whole live catalogue
 * is eligible, and a stream of these posts reads as a varied lookbook rather
 * than the same single cap shared by everyone.
 */
export async function getShareCardProductPool(): Promise<ShareCardProduct[]> {
  const chapters = await getAllChapters();
  return chapters
    .filter((c) => c.verifiedOnSite !== false)
    .map((c) => ({ imageUrl: chapterImageSrc(c.folder, c.sideImage), productName: c.name }));
}

/**
 * With a sequence number (the order's position among barter orders), picks
 * in rotation from a shuffled-but-fixed ordering of the pool, so every
 * consecutive post gets a different cap and the whole catalogue cycles
 * before any repeat. Falls back to a plain hash of the seed otherwise.
 */
export function pickShareCardProduct(pool: ShareCardProduct[], seed: string, sequence?: number): ShareCardProduct | null {
  if (pool.length === 0) return null;
  if (sequence === undefined) return pool[hashToIndex(seed, pool.length)];
  // Fixed shuffle (by name hash) so the rotation doesn't just walk the
  // catalogue in homepage order.
  const shuffled = [...pool].sort((a, b) => hashToIndex(a.productName, 1_000_003) - hashToIndex(b.productName, 1_000_003));
  return shuffled[sequence % shuffled.length];
}
