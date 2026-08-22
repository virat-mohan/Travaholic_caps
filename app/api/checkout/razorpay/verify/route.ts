import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { verifyRazorpaySignature } from "@/lib/razorpay";
import { sendInvoiceEmail, sendOrderNotificationEmail } from "@/lib/email";
import { sendOrderConfirmationWhatsApp } from "@/lib/whatsapp-notify";
import { markCartSessionConverted } from "@/lib/cart-session-convert";
import { computeTrustedOrderTotal, getCodAdvanceRupees } from "@/lib/order-pricing";
import { earnMilesForOrder, redeemMilesForOrder } from "@/lib/loyalty";
import { applyNewsletterOptIn } from "@/lib/newsletter";
import { recordGuestCheckoutLead } from "@/lib/leads";
import { rewardReferrer } from "@/lib/referrals";
import { findOrCreateCustomerForGuest } from "@/lib/auth";

type OrderPayload = {
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
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order } = body ?? {};

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !order?.items?.length) {
    return NextResponse.json({ error: "Missing payment or order details" }, { status: 400 });
  }

  const payload = order as OrderPayload;

  try {
    const valid = await verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );
    if (!valid) {
      return NextResponse.json({ error: "Payment signature verification failed" }, { status: 400 });
    }

    // Idempotency guard — a retried/double-submitted verify call (network
    // retry, double-click before the button disabled) must never create a
    // second order for the same payment. Without this, a retry would
    // double-decrement inventory, double-earn Miles, and double-pay a
    // referrer, none of which a duplicate signature check alone prevents.
    const supabase = getSupabaseServerClient();
    const { data: existingOrder } = await supabase
      .from("orders")
      .select("id")
      .eq("razorpay_payment_id", razorpay_payment_id)
      .maybeSingle();
    if (existingOrder) {
      return NextResponse.json({ orderId: existingOrder.id });
    }

    // Recomputed independently of whatever the client sent — this must match
    // what create-order charged, since both derive from the same trusted
    // source (catalogue prices, the active discount rule, the ledger).
    const pricing = await computeTrustedOrderTotal(
      payload.items,
      payload.redeemMilesRupees,
      payload.customer.pincode,
      payload.referralCode,
      payload.customer.phone
    );

    // Guest checkout (no OTP session) still gets a real customer record —
    // matched/deduped by phone/email, never a logged-in session — so Miles
    // and a referral code work for them too, not just people who verified.
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
        is_gift: payload.isGift ?? false,
        gift_note: payload.giftNote ?? null,
        customer_id: effectiveCustomerId,
        status: "confirmed",
        // "paid" here means the order-confirming payment succeeded — for a
        // COD-advance order that's just the advance, balance_due is what
        // distinguishes it from a fully-settled prepaid order.
        payment_status: "paid",
        razorpay_order_id,
        razorpay_payment_id,
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

    return NextResponse.json({ orderId: savedOrder.id });
  } catch (err) {
    console.error("Failed to verify/save Razorpay order", err);
    return NextResponse.json({ error: "Could not complete order" }, { status: 500 });
  }
}
