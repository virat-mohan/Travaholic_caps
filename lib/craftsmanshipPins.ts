export type CraftsmanshipPin = { x: number; y: number };

export const CRAFTSMANSHIP_LABELS = [
  "Hand-Sketched Patch Graphic",
  "Poly-Blend Cotton Twill Fabric",
  "Featherlight, All-Day Wear",
  "Structured To Hold Its Shape",
  "Curved Brim For Real Sun Coverage",
  "Premium Stitch Reinforcement",
] as const;

/** Fallback positions, tuned against the tightly-cropped /images/craftsmanship set. */
const DEFAULT_PINS: Record<string, CraftsmanshipPin> = {
  "Hand-Sketched Patch Graphic": { x: 38, y: 32 },
  "Poly-Blend Cotton Twill Fabric": { x: 55, y: 18 },
  "Featherlight, All-Day Wear": { x: 50, y: 55 },
  "Structured To Hold Its Shape": { x: 70, y: 25 },
  "Curved Brim For Real Sun Coverage": { x: 35, y: 68 },
  "Premium Stitch Reinforcement": { x: 45, y: 40 },
};

/**
 * Per-chapter overrides, calibrated at /admin/craftsmanship-pins. Add a slug's
 * entry here once the client sends back the JSON from that tool.
 */
export const CRAFTSMANSHIP_OVERRIDES: Record<string, Record<string, CraftsmanshipPin>> = {
  "travaholic-black": {
    "Hand-Sketched Patch Graphic": { x: 39.29, y: 33.97 },
    "Poly-Blend Cotton Twill Fabric": { x: 22.71, y: 69.57 },
    "Featherlight, All-Day Wear": { x: 60.29, y: 26.37 },
    "Structured To Hold Its Shape": { x: 81.86, y: 36.37 },
    "Curved Brim For Real Sun Coverage": { x: 46.43, y: 79.17 },
    "Premium Stitch Reinforcement": { x: 69.71, y: 72.97 },
  },
  "travaholic-ocean": {
    "Hand-Sketched Patch Graphic": { x: 37.71, y: 38.77 },
    "Poly-Blend Cotton Twill Fabric": { x: 27.43, y: 64.37 },
    "Featherlight, All-Day Wear": { x: 57, y: 26.37 },
    "Structured To Hold Its Shape": { x: 79.43, y: 33.97 },
    "Curved Brim For Real Sun Coverage": { x: 50.86, y: 86.37 },
    "Premium Stitch Reinforcement": { x: 67, y: 75.17 },
  },
  "travaholic-sky": {
    "Hand-Sketched Patch Graphic": { x: 42.43, y: 37.77 },
    "Poly-Blend Cotton Twill Fabric": { x: 25.43, y: 60.77 },
    "Featherlight, All-Day Wear": { x: 69, y: 30.37 },
    "Structured To Hold Its Shape": { x: 74, y: 53.77 },
    "Curved Brim For Real Sun Coverage": { x: 39.43, y: 82.77 },
    "Premium Stitch Reinforcement": { x: 65.86, y: 75.77 },
  },
  "beachn": {
    "Hand-Sketched Patch Graphic": { x: 40.57, y: 40.77 },
    "Poly-Blend Cotton Twill Fabric": { x: 25.29, y: 59.77 },
    "Featherlight, All-Day Wear": { x: 67.86, y: 28.57 },
    "Structured To Hold Its Shape": { x: 82.14, y: 37.97 },
    "Curved Brim For Real Sun Coverage": { x: 36.57, y: 81.77 },
    "Premium Stitch Reinforcement": { x: 62.71, y: 72.17 },
  },
  "sunshine": {
    "Hand-Sketched Patch Graphic": { x: 40.71, y: 33.77 },
    "Poly-Blend Cotton Twill Fabric": { x: 16.86, y: 69.57 },
    "Featherlight, All-Day Wear": { x: 66.71, y: 24.37 },
    "Structured To Hold Its Shape": { x: 84.71, y: 39.17 },
    "Curved Brim For Real Sun Coverage": { x: 49.14, y: 86.37 },
    "Premium Stitch Reinforcement": { x: 69.43, y: 71.37 },
  },
  "tropical-blue": {
    "Hand-Sketched Patch Graphic": { x: 34.43, y: 42.37 },
    "Poly-Blend Cotton Twill Fabric": { x: 17.43, y: 68.37 },
    "Featherlight, All-Day Wear": { x: 65.86, y: 30.17 },
    "Structured To Hold Its Shape": { x: 83.86, y: 42.17 },
    "Curved Brim For Real Sun Coverage": { x: 45.57, y: 85.37 },
    "Premium Stitch Reinforcement": { x: 69.14, y: 76.57 },
  },
  "tropical-pink": {
    "Hand-Sketched Patch Graphic": { x: 44.29, y: 38.37 },
    "Poly-Blend Cotton Twill Fabric": { x: 20.29, y: 66.77 },
    "Featherlight, All-Day Wear": { x: 72.57, y: 36.97 },
    "Structured To Hold Its Shape": { x: 85.43, y: 48.17 },
    "Curved Brim For Real Sun Coverage": { x: 49.29, y: 85.57 },
    "Premium Stitch Reinforcement": { x: 69.71, y: 76.57 },
  },
  "dunes-maroon": {
    "Hand-Sketched Patch Graphic": { x: 41.57, y: 36.77 },
    "Poly-Blend Cotton Twill Fabric": { x: 17.29, y: 64.97 },
    "Featherlight, All-Day Wear": { x: 66.57, y: 22.97 },
    "Structured To Hold Its Shape": { x: 85.71, y: 44.57 },
    "Curved Brim For Real Sun Coverage": { x: 47.71, y: 83.37 },
    "Premium Stitch Reinforcement": { x: 66.86, y: 70.97 },
  },
  "dunes-yellow": {
    "Hand-Sketched Patch Graphic": { x: 40, y: 32.37 },
    "Poly-Blend Cotton Twill Fabric": { x: 21.57, y: 65.77 },
    "Featherlight, All-Day Wear": { x: 65.71, y: 27.17 },
    "Structured To Hold Its Shape": { x: 78.43, y: 34.17 },
    "Curved Brim For Real Sun Coverage": { x: 44.71, y: 85.97 },
    "Premium Stitch Reinforcement": { x: 65.86, y: 72.77 },
  },
  "peaking": {
    "Hand-Sketched Patch Graphic": { x: 44.71, y: 28.17 },
    "Poly-Blend Cotton Twill Fabric": { x: 17, y: 66.37 },
    "Featherlight, All-Day Wear": { x: 70.43, y: 31.37 },
    "Structured To Hold Its Shape": { x: 81.71, y: 39.97 },
    "Curved Brim For Real Sun Coverage": { x: 43.43, y: 83.97 },
    "Premium Stitch Reinforcement": { x: 66, y: 74.57 },
  },
  "travaholic-snow": {
    "Hand-Sketched Patch Graphic": { x: 38.71, y: 33.77 },
    "Poly-Blend Cotton Twill Fabric": { x: 17.86, y: 72.97 },
    "Featherlight, All-Day Wear": { x: 67.86, y: 36.77 },
    "Structured To Hold Its Shape": { x: 85.29, y: 47.77 },
    "Curved Brim For Real Sun Coverage": { x: 52.71, y: 87.77 },
    "Premium Stitch Reinforcement": { x: 70.14, y: 73.97 },
  },
  "wildling": {
    "Hand-Sketched Patch Graphic": { x: 41.43, y: 37.57 },
    "Poly-Blend Cotton Twill Fabric": { x: 16.57, y: 69.37 },
    "Featherlight, All-Day Wear": { x: 61.71, y: 36.97 },
    "Structured To Hold Its Shape": { x: 81.43, y: 40.37 },
    "Curved Brim For Real Sun Coverage": { x: 41.43, y: 79.17 },
    "Premium Stitch Reinforcement": { x: 62.14, y: 68.57 },
  },
  "junglee": {
    "Hand-Sketched Patch Graphic": { x: 41.43, y: 35.57 },
    "Poly-Blend Cotton Twill Fabric": { x: 14.57, y: 65.37 },
    "Featherlight, All-Day Wear": { x: 63.71, y: 30.37 },
    "Structured To Hold Its Shape": { x: 86.71, y: 43.17 },
    "Curved Brim For Real Sun Coverage": { x: 35, y: 80.97 },
    "Premium Stitch Reinforcement": { x: 60.86, y: 71.37 },
  },
  "city-slicker": {
    "Hand-Sketched Patch Graphic": { x: 40, y: 37.77 },
    "Poly-Blend Cotton Twill Fabric": { x: 17.14, y: 63.37 },
    "Featherlight, All-Day Wear": { x: 62.43, y: 31.97 },
    "Structured To Hold Its Shape": { x: 45.57, y: 80.37 },
    "Curved Brim For Real Sun Coverage": { x: 81.57, y: 46.77 },
    "Premium Stitch Reinforcement": { x: 64.29, y: 73.77 },
  },
  "city-slicker-black": {
    "Hand-Sketched Patch Graphic": { x: 45.43, y: 33.97 },
    "Poly-Blend Cotton Twill Fabric": { x: 20, y: 67.17 },
    "Featherlight, All-Day Wear": { x: 71.86, y: 35.77 },
    "Structured To Hold Its Shape": { x: 85.43, y: 46.77 },
    "Curved Brim For Real Sun Coverage": { x: 43, y: 78.97 },
    "Premium Stitch Reinforcement": { x: 62.57, y: 71.57 },
  },
  "travaholic-orange": {
    "Hand-Sketched Patch Graphic": { x: 43.71, y: 35.97 },
    "Poly-Blend Cotton Twill Fabric": { x: 15.57, y: 65.57 },
    "Featherlight, All-Day Wear": { x: 64.57, y: 30.97 },
    "Structured To Hold Its Shape": { x: 80, y: 44.97 },
    "Curved Brim For Real Sun Coverage": { x: 37.57, y: 83.57 },
    "Premium Stitch Reinforcement": { x: 61.86, y: 71.57 },
  },
};

export function craftsmanshipPinsFor(slug: string) {
  const overrides = CRAFTSMANSHIP_OVERRIDES[slug] ?? {};
  return CRAFTSMANSHIP_LABELS.map((label) => ({
    label,
    ...(overrides[label] ?? DEFAULT_PINS[label]),
  }));
}
