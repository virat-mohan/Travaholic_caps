/**
 * Pure money rules shared by the checkout page (display) and the server
 * (what is actually charged). No imports, so Node's test runner can load it.
 * Audit standard (same as the Moonglasses audit):
 *  - quantity is an integer from 1 to 50
 *  - one discount per order (the best one for the shopper)
 *  - total floored at ₹1, except a genuine free-reward code, which may be ₹0
 *  - the amount paid must equal the trusted total
 */
export const MAX_QTY_PER_LINE = 50;

export function isValidQuantity(q: unknown): q is number {
  return typeof q === "number" && Number.isInteger(q) && q >= 1 && q <= MAX_QTY_PER_LINE;
}

export function assertValidItems(items: unknown): asserts items is { slug: string; quantity: number }[] {
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) throw new Error("Invalid cart");
  for (const it of items) {
    if (!it || typeof it.slug !== "string" || !it.slug) throw new Error("Invalid cart item");
    if (!isValidQuantity(it.quantity)) throw new Error("Quantity must be a whole number from 1 to 50");
  }
}

export type DiscountCandidates = { rule: number; loyalty: number; referral: number; coupon: number };
export type DiscountKind = keyof DiscountCandidates | null;

/** Keeps only the single largest discount; the rest become 0. */
export function pickSingleDiscount(c: DiscountCandidates): DiscountCandidates & { kind: DiscountKind } {
  const zero = { rule: 0, loyalty: 0, referral: 0, coupon: 0 };
  let kind: DiscountKind = null;
  let best = 0;
  for (const k of ["rule", "coupon", "referral", "loyalty"] as const) {
    const v = Math.max(0, Math.round(c[k] || 0));
    if (v > best) { best = v; kind = k; }
  }
  return kind ? { ...zero, [kind]: best, kind } : { ...zero, kind };
}

/**
 * Goods total after the one discount, floored at ₹1. A free-reward code
 * (a 100%-off coupon that is the applied discount) is the only way to ₹0.
 */
export function flooredGoodsTotal(subtotal: number, discount: number, isFreeReward: boolean) {
  const raw = Math.max(0, subtotal - discount);
  if (subtotal <= 0) return 0;
  if (isFreeReward) return raw;
  return Math.max(1, raw);
}

/** Paid amount (paise, from Razorpay) must equal the trusted charge exactly. */
export function amountMatches(paidPaise: number, expectedRupees: number) {
  return Number.isFinite(paidPaise) && paidPaise === Math.round(expectedRupees * 100);
}

/** tracking_events.value is an integer column — a fractional value made the insert fail silently. */
export function toTrackingValue(v: unknown): number | undefined {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? Math.round(n) : undefined;
}

/** Only short, safe step names reach the funnel log. */
export function toCheckoutStepPath(step: unknown): string | null {
  if (typeof step !== "string") return null;
  const clean = step.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 60);
  return clean ? `/checkout#${clean}` : null;
}
