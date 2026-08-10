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
export const CRAFTSMANSHIP_OVERRIDES: Record<string, Record<string, CraftsmanshipPin>> = {};

export function craftsmanshipPinsFor(slug: string) {
  const overrides = CRAFTSMANSHIP_OVERRIDES[slug] ?? {};
  return CRAFTSMANSHIP_LABELS.map((label) => ({
    label,
    ...(overrides[label] ?? DEFAULT_PINS[label]),
  }));
}
