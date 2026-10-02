import { getAllChapters } from "@/lib/chapters-dynamic";
import { calculateDiscount, type DiscountRule } from "@/lib/discounts";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getCurrentCustomer } from "@/lib/auth";
import { getRedeemableAmount } from "@/lib/loyalty";
import { getShippingRate } from "@/lib/shiprocket";
import { getSetting } from "@/lib/settings";
import { resolveReferralDiscount } from "@/lib/referrals";
import { resolveCouponDiscount } from "@/lib/coupons";
import { assertValidItems, pickSingleDiscount, flooredGoodsTotal } from "@/lib/money-rules";

/** The fixed amount charged upfront for a COD order — the rest is collected by the courier on delivery. */
export async function getCodAdvanceRupees() {
  const setting = await getSetting("COD_ADVANCE_AMOUNT_RUPEES");
  return setting ? Number(setting) : 99;
}

/**
 * Recomputes an order's pricing entirely server-side — item prices, the
 * active discount rule, any Miles redemption, and shipping — rather than
 * trusting whatever numbers the client sent. This is what the Razorpay flow
 * charges against; a tampered client request can't change what actually
 * gets billed. Shipping is looked up fresh from Shiprocket by pincode
 * (never a client-supplied amount) so it stays a genuine cost pass-through.
 */
export async function computeTrustedOrderTotal(
  items: { slug: string; quantity: number }[],
  requestedRedeemRupees?: number,
  deliveryPincode?: string,
  referralCode?: string | null,
  checkoutPhone?: string,
  couponCode?: string | null,
  paymentType: "prepaid" | "cod_advance" = "prepaid"
) {
  // Quantity is an integer 1-50 per line — a fractional, negative or huge
  // quantity must never reach pricing or stock.
  assertValidItems(items);
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
  const ruleDiscountCandidate = calculateDiscount(pricedItems, discountRule);

  const customer = await getCurrentCustomer();
  let loyaltyCandidate = 0;
  if (customer && requestedRedeemRupees) {
    const { maxRedeemableRupees } = await getRedeemableAmount(customer.id);
    loyaltyCandidate = Math.max(0, Math.min(Number(requestedRedeemRupees) || 0, maxRedeemableRupees));
  }

  // Free shipping is a prepaid-only perk — a COD order still needs the real
  // Shiprocket rate checked (both to confirm the pincode is deliverable at
  // all, and because the courier collects it as part of the balance due).
  let shippingCharge = 0;
  if (deliveryPincode) {
    const unitCount = pricedItems.reduce((sum, item) => sum + item.quantity, 0);
    const shippingResult = await getShippingRate(deliveryPincode, unitCount);
    // Only a confirmed "Shiprocket can't deliver here" blocks the order —
    // our own misconfiguration or a transient API error must never turn
    // away a real customer, see getShippingRate's doc comment.
    if (shippingResult.status === "checked_unavailable") {
      throw new Error(
        `Sorry — pincode ${deliveryPincode} is not serviceable by our couriers yet. Please double-check it or use a different delivery address.`
      );
    }
    // Server-side twin of the checkout's COD hiding — a tampered client
    // must not be able to place a COD order on a prepaid-only lane.
    // COD is switched off store-wide (prepaid only, free shipping) — refuse
    // it here too so a cached/old checkout page can't still place one.
    if (paymentType === "cod_advance") {
      throw new Error("Cash on Delivery is no longer available — please pay online. Shipping is free on prepaid orders.");
    }
    const realRate = shippingResult.status === "available" ? shippingResult.rate : 0;
    shippingCharge = paymentType === "prepaid" ? 0 : realRate;
  }

  const referralResolved = await resolveReferralDiscount(referralCode, customer?.id ?? null, checkoutPhone ?? "");
  const couponResolved = await resolveCouponDiscount(couponCode, subtotal);

  // One discount per order: the best one for the shopper wins, the others
  // don't stack (and aren't redeemed/recorded).
  const one = pickSingleDiscount({
    rule: ruleDiscountCandidate,
    loyalty: loyaltyCandidate,
    referral: referralResolved ? Math.min(referralResolved.discountRupees, subtotal) : 0,
    coupon: couponResolved ? couponResolved.discountRupees : 0,
  });
  const discountAmount = one.rule;
  const loyaltyDiscountAmount = one.loyalty;
  const referralDiscountAmount = one.referral;
  const couponDiscountAmount = one.coupon;
  const referral = one.kind === "referral" ? referralResolved : null;
  const coupon = one.kind === "coupon" ? couponResolved : null;
  // Genuine free-reward code: a coupon that covers the whole subtotal.
  const isFreeReward = !!coupon && couponDiscountAmount >= subtotal;

  const total =
    flooredGoodsTotal(subtotal, discountAmount + loyaltyDiscountAmount + referralDiscountAmount + couponDiscountAmount, isFreeReward) +
    shippingCharge;

  return {
    items: pricedItems,
    subtotal,
    discountAmount,
    discountRule: one.kind === "rule" ? discountRule : null,
    discountKind: one.kind,
    loyaltyDiscountAmount,
    referralDiscountAmount,
    referral,
    couponDiscountAmount,
    coupon,
    shippingCharge,
    total,
    customer,
  };
}
