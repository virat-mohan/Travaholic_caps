export type StorySeries =
  | "The Essentials"
  | "Blue Horizon"
  | "Summer Escape"
  | "Desert Trails"
  | "Above The Clouds"
  | "Into The Wild"
  | "Urban Nomad"
  | "Trail Markers";

export type Chapter = {
  slug: string;
  name: string;
  series: StorySeries;
  /** Folder name under public/images/chapters, kept exactly as supplied. */
  folder: string;
  /** Filenames within that folder, in display order. */
  images: string[];
  /** Filename of the hero shot shown on this Chapter's own detail page — admin-editable, doesn't affect anywhere else. */
  primary: string;
  /** Filename of the side-profile shot used everywhere a product is browsed (homepage, series grids, explore globe) — fixed per Chapter, independent of `primary`. */
  sideImage: string;
  /** Short founder-voice story for this Chapter. */
  story: string;
  /** Price in INR. Flat pricing per travaholic-build-brief.md — no discount gimmicks. */
  price: number;
  /** False for Chapters not found live on travaholic.in at brief time — flagged, not guessed. */
  verifiedOnSite: boolean;
};
