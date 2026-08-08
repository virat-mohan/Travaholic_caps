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
  /** Filename of the angled hero shot used as the card/primary image. */
  primary: string;
  /** Short founder-voice story for this Chapter. */
  story: string;
  /** Price in INR. Flat pricing per travaholic-build-brief.md — no discount gimmicks. */
  price: number;
  /** False for Chapters not found live on travaholic.in at brief time — flagged, not guessed. */
  verifiedOnSite: boolean;
};
