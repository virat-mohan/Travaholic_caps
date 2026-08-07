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
};
