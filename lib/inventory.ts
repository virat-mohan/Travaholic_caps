import { getSupabaseServerClient } from "@/lib/supabase";

export type StockLabel = "out-of-stock" | "selling-fast" | null;

// Small-batch stock — 10 units left is the point urgency messaging starts
// being credibly true rather than a generic marketing nudge.
const SELLING_FAST_THRESHOLD = 10;

export function stockLabelFor(stock: number | undefined): StockLabel {
  if (stock === undefined) return null;
  if (stock <= 0) return "out-of-stock";
  if (stock <= SELLING_FAST_THRESHOLD) return "selling-fast";
  return null;
}

/** Chapter slug -> stock on hand. Missing slugs simply render no badge. */
export async function getInventoryMap(): Promise<Record<string, number>> {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.from("inventory").select("chapter_slug, stock_on_hand");
    if (error || !data) return {};
    return Object.fromEntries(data.map((row) => [row.chapter_slug, row.stock_on_hand]));
  } catch {
    return {};
  }
}
