import { getSupabaseServerClient } from "@/lib/supabase";
import { sendInvoiceEmail, sendOrderNotificationEmail } from "@/lib/email";
import { sendOrderConfirmationWhatsApp } from "@/lib/whatsapp-notify";
import { markCartSessionConverted } from "@/lib/cart-session-convert";
import { computeTrustedOrderTotal, getCodAdvanceRupees } from "@/lib/order-pricing";
import { earnMilesForOrder, redeemMilesForOrder } from "@/lib/loyalty";
import { applyNewsletterOptIn } from "@/lib/newsletter";
import { recordGuestCheckoutLead } from "@/lib/leads";
import { rewardReferrer } from "@/lib/referrals";
import { redeemCoupon } from "@/lib/coupons";
import { findOrCreateCustomerForGuest } from "@/lib/auth";

export type OrderPayload = {
  customer: {
    name: string;
    phone: string;
    email: string;
    address: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  items: { slug: string; quantity: number }[];
  isGift?: boolean;
  giftNote?: string | null;
  sessionKey?: string;
  redeemMilesRupees?: number;
  newsletterOptIn?: boolean;
  paymentType?: "prepaid" | "cod_advance";
  attributedAdBriefId?: string | null;
  referralCode?: string | null;
  couponCode?: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The single place a prepaid order actually gets created and fulfilled —
 * called from both the client-driven /verify route (the normal path) and
 * the Razorpay webhook (the safety-net path, when a customer's payment
 * succeeded but their browser never made it back to call /verify — a
 * crashed tab, closed app, or dropped connection right after paying).
 * Idempotent by razorpay_payment_id, so it's safe for both paths to race
 * or for the webhook to retry.
 */
export async function finalizeOrder(
  payload: OrderPayload,
  razorpayOrderId: string,
  razorpayPaymentId: string
) {
  const supabase = getSupabaseServerClient();

  const { data: existingOrder } = await supabase
    .from("orders")
    .select("id")
    .eq("razorpay_payment_id", razorpayPaymentId)
    .maybeSingle();
  if (existingOrder) {
    return { orderId: existingOrder.id as string, alreadyExisted: true };
  }

  const pricing = await computeTrustedOrderTotal(
    payload.items,
    payload.redeemMilesRupees,
    payload.customer.pincode,
    payload.referralCode,
    payload.customer.phone,
    payload.couponCode
  );

  const wasGuest = !pricing.customer;
  const guestCustomer = wasGuest
    ? await findOrCreateCustomerForGuest(payload.customer.phone, payload.customer.email, payload.customer.name)
    : null;
  const effectiveCustomerId = pricing.customer?.id ?? guestCustomer?.id ?? null;

  const isCodAdvance = payload.paymentType === "cod_advance";
  const codAdvanceAmount = isCodAdvance ? Math.min(await getCodAdvanceRupees(), pricing.total) : 0;
  const balanceDue = isCodAdvance ? pricing.total - codAdvanceAmount : 0;
  const attributedAdBriefId =
    payload.attributedAdBriefId && UUID_RE.test(payload.attributedAdBriefId)
      ? payload.attributedAdBriefId
      : null;

  const { data: savedOrder, error: orderError } = await supabase
    .from("orders")
    .insert({
      customer_name: payload.customer.name,
      customer_phone: payload.customer.phone,
      customer_email: payload.customer.email,
      delivery_address: payload.customer.address,
      delivery_city: payload.customer.city ?? null,
      delivery_state: payload.customer.state ?? null,
      delivery_pincode: payload.customer.pincode ?? null,
      subtotal: pricing.subtotal,
      discount_amount: pricing.discountAmount,
      loyalty_discount_amount: pricing.loyaltyDiscountAmount,
      shipping_charge: pricing.shippingCharge,
      total: pricing.total,
      payment_type: isCodAdvance ? "cod_advance" : "prepaid",
      cod_advance_amount: codAdvanceAmount,
      balance_due: balanceDue,
      attributed_ad_brief_id: attributedAdBriefId,
      referral_code_used: pricing.referral ? payload.referralCode?.toUpperCase() : null,
      referral_discount_amount: pricing.referralDiscountAmount,
      coupon_code_used: pricing.coupon ? pricing.coupon.code : null,
      coupon_discount_amount: pricing.couponDiscountAmount,
      is_gift: payload.isGift ?? false,
      gift_note: payload.giftNote ?? null,
      customer_id: effectiveCustomerId,
      status: "confirmed",
      payment_status: "paid",
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
    })
    .select()
    .single();

  if (orderError) throw orderError;

  const orderItems = pricing.items.map((item) => ({
    order_id: savedOrder.id,
    chapter_slug: item.slug,
    chapter_name: item.name,
    unit_price: item.price,
    quantity: item.quantity,
  }));

  const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
  if (itemsError) throw itemsError;

  for (const item of pricing.items) {
    const { data: inv } = await supabase
      .from("inventory")
      .select("stock_on_hand")
      .eq("chapter_slug", item.slug)
      .maybeSingle();
    if (inv) {
      await supabase
        .from("inventory")
        .update({ stock_on_hand: Math.max(0, inv.stock_on_hand - item.quantity) })
        .eq("chapter_slug", item.slug);
    }
  }

  if (effectiveCustomerId) {
    const capsBought = pricing.items.reduce((sum, item) => sum + item.quantity, 0);
    if (pricing.customer && pricing.loyaltyDiscountAmount > 0) {
      await redeemMilesForOrder(effectiveCustomerId, savedOrder.id, pricing.loyaltyDiscountAmount);
    }
    await earnMilesForOrder(effectiveCustomerId, savedOrder.id, capsBought);
  }

  if (payload.newsletterOptIn != null) {
    await applyNewsletterOptIn(effectiveCustomerId, savedOrder.customer_email, payload.newsletterOptIn);
  }

  if (pricing.referral) {
    await rewardReferrer(
      pricing.referral.referrerCustomerId,
      savedOrder.id,
      effectiveCustomerId,
      payload.customer.phone,
      pricing.referral.rewardMiles
    );
  }

  if (wasGuest) {
    await recordGuestCheckoutLead({
      name: payload.customer.name,
      phone: payload.customer.phone,
      email: payload.customer.email,
      chapterName: pricing.items[0]?.name,
    });
  }

  if (pricing.coupon) {
    await redeemCoupon(
      pricing.coupon.couponId,
      savedOrder.id,
      pricing.couponDiscountAmount,
      payload.customer.phone,
      payload.customer.email
    );
  }

  // Best-effort — a failed email/WhatsApp send shouldn't fail the order.
  await Promise.allSettled([
    sendInvoiceEmail(savedOrder, orderItems),
    sendOrderNotificationEmail(savedOrder, orderItems),
    sendOrderConfirmationWhatsApp(savedOrder, orderItems),
  ]);

  await markCartSessionConverted(payload.sessionKey, {
    id: savedOrder.id,
    customer_email: savedOrder.customer_email,
    customer_phone: savedOrder.customer_phone,
    total: pricing.total,
  });

  return { orderId: savedOrder.id as string, alreadyExisted: false };
}
