export type DiscountRule = {
  id: string;
  name: string;
  buyQuantity: number;
  discountPercent: number;
};

/**
 * A short, shopper-facing line for the active rule — used everywhere the
 * offer needs to be announced (homepage, product pages, cart) before the
 * per-cart discount math in calculateDiscount ever runs. Special-cases the
 * 100%-off case into the more familiar "get 1 free" phrasing rather than
 * the technically-equivalent-but-clunkier "cheapest at 100% off".
 */
export function describeDiscountRule(rule: DiscountRule): string {
  const freeCount = 1;
  const paidCount = rule.buyQuantity - freeCount;
  if (rule.discountPercent >= 100 && paidCount >= 1) {
    return `Buy ${paidCount}, Get ${freeCount} Free`;
  }
  return `Buy ${rule.buyQuantity}, Cheapest At ${rule.discountPercent}% Off`;
}

/**
 * "Buy N, cheapest one at X% off" — sort every unit in the cart by price
 * descending, then every Nth unit (the cheapest in each group of N) gets
 * discountPercent off. Generalizes "buy 2 get 3rd at half price" (N=3, 50%).
 */
export function calculateDiscount(
  items: { price: number; quantity: number }[],
  rule: DiscountRule | null
): number {
  if (!rule || rule.buyQuantity < 2) return 0;

  const units = items.flatMap((item) => Array(item.quantity).fill(item.price));
  units.sort((a, b) => b - a);

  let discount = 0;
  for (let i = rule.buyQuantity - 1; i < units.length; i += rule.buyQuantity) {
    discount += Math.round((units[i] * rule.discountPercent) / 100);
  }
  return discount;
}
