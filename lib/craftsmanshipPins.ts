export type CraftsmanshipPin = { x: number; y: number };

export const CRAFTSMANSHIP_LABELS = [
  "Embroidered Patch Graphic",
  "Poly-Blend Cotton Twill",
  "Made In India",
  "One Size — 52 to 60cm",
  "Curved Brim",
  "Reinforced Stitching",
] as const;

/** Fallback positions, tuned against the tightly-cropped /images/craftsmanship set. */
const DEFAULT_PINS: Record<string, CraftsmanshipPin> = {
  "Embroidered Patch Graphic": { x: 38, y: 32 },
  "Poly-Blend Cotton Twill": { x: 55, y: 18 },
  "Made In India": { x: 50, y: 55 },
  "One Size — 52 to 60cm": { x: 70, y: 25 },
  "Curved Brim": { x: 35, y: 68 },
  "Reinforced Stitching": { x: 45, y: 40 },
};

/**
 * Per-chapter overrides, calibrated at /admin/craftsmanship-pins. Add a slug's
 * entry here once the client sends back the JSON from that tool.
 */
export const CRAFTSMANSHIP_OVERRIDES: Record<string, Record<string, CraftsmanshipPin>> = {};

export function craftsmanshipPinsFor(slug: string) {
  const overrides = CRAFTSMANSHIP_OVERRIDES[slug] ?? {};
  return CRAFTSMANSHIP_LABELS.map((label) => ({
    label,
    ...(overrides[label] ?? DEFAULT_PINS[label]),
  }));
}
