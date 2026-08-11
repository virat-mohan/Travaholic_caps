import { getAllChapters } from "@/lib/chapters-dynamic";
import { calculateDiscount, type DiscountRule } from "@/lib/discounts";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getCurrentCustomer } from "@/lib/auth";
import { getRedeemableAmount } from "@/lib/loyalty";

/**
 * Recomputes an order's pricing entirely server-side — item prices, the
 * active discount rule, and any Miles redemption — rather than trusting
 * whatever numbers the client sent. This is what the Razorpay flow charges
 * against; a tampered client request can't change what actually gets billed.
 */
export async function computeTrustedOrderTotal(
  items: { slug: string; quantity: number }[],
  requestedRedeemRupees?: number
) {
  const chapters = await getAllChapters();
  const pricedItems = items.map((item) => {
    const chapter = chapters.find((c) => c.slug === item.slug);
    if (!chapter) throw new Error(`Unknown chapter: ${item.slug}`);
    return { slug: item.slug, name: chapter.name, price: chapter.price, quantity: item.quantity };
  });

  const subtotal = pricedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const supabase = getSupabaseServerClient();
  const { data: ruleRow } = await supabase
    .from("discount_rules")
    .select("id, name, buy_quantity, discount_percent")
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  const discountRule: DiscountRule | null = ruleRow
    ? {
        id: ruleRow.id,
        name: ruleRow.name,
        buyQuantity: ruleRow.buy_quantity,
        discountPercent: ruleRow.discount_percent,
      }
    : null;
  const discountAmount = calculateDiscount(pricedItems, discountRule);

  const customer = await getCurrentCustomer();
  let loyaltyDiscountAmount = 0;
  if (customer && requestedRedeemRupees) {
    const { maxRedeemableRupees } = await getRedeemableAmount(customer.id);
    loyaltyDiscountAmount = Math.min(requestedRedeemRupees, maxRedeemableRupees);
  }

  const total = Math.max(0, subtotal - discountAmount - loyaltyDiscountAmount);

  return { items: pricedItems, subtotal, discountAmount, loyaltyDiscountAmount, total, customer };
}
