import type { StorySeries } from "@/types/chapter";
import { chapters } from "@/lib/chapters";

export const seriesOrder: { name: StorySeries; slug: string; blurb: string }[] = [
  {
    name: "Summer Escape",
    slug: "summer-escape",
    blurb: "Endless coastlines, warm evenings, memories made under open skies.",
  },
  {
    name: "Into The Wild",
    slug: "into-the-wild",
    blurb: "Forest trails, quiet mountains, the hours your phone has no signal.",
  },
  {
    name: "Blue Horizon",
    slug: "blue-horizon",
    blurb: "Sky, water, and the line where you can't tell them apart.",
  },
  {
    name: "Urban Nomad",
    slug: "urban-nomad",
    blurb: "New skylines, unfamiliar coffee, cities that feel like trails.",
  },
  {
    name: "Above The Clouds",
    slug: "above-the-clouds",
    blurb: "Cold air, thin light, the view that finally quiets your legs.",
  },
  {
    name: "Desert Trails",
    slug: "desert-trails",
    blurb: "Sand, heat, and the last good hour before noon.",
  },
];

export function seriesChapters(name: StorySeries) {
  return chapters.filter((c) => c.series === name);
}
