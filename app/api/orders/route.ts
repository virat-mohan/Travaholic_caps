import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { markCartSessionConverted } from "@/lib/cart-session-convert";
import { findOrCreateCustomerForGuest } from "@/lib/auth";
import { sendOrderNotificationEmail } from "@/lib/email";
import { applyNewsletterOptIn } from "@/lib/newsletter";
import { computeTrustedOrderTotal } from "@/lib/order-pricing";

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
  items: { slug: string; name: string; price: number; quantity: number }[];
  subtotal: number;
  discountAmount?: number;
  isGift?: boolean;
  giftNote?: string | null;
  sessionKey?: string;
  redeemMilesRupees?: number;
  newsletterOptIn?: boolean;
  attributedAdBriefId?: string | null;
  couponCode?: string | null;
  referralCode?: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  let body: OrderPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.customer || !body.items?.length) {
    return NextResponse.json({ error: "Missing customer or items" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();

    // Unpaid WhatsApp order request. Money audit: prices, discount and total
    // are recomputed server-side (never the client's numbers); stock, Miles,
    // coupons and referral rewards are NOT touched here, because nothing has
    // been paid. Those run only in finalizeOrder once payment is confirmed.
    const pricing = await computeTrustedOrderTotal(
      body.items.map((i) => ({ slug: i.slug, quantity: i.quantity })),
      body.redeemMilesRupees,
      body.customer.pincode,
      body.referralCode,
      body.customer.phone,
      body.couponCode,
      "prepaid"
    );
    const customer = pricing.customer;
    const guestCustomer = !customer
      ? await findOrCreateCustomerForGuest(body.customer.phone, body.customer.email, body.customer.name)
      : null;
    const effectiveCustomerId = customer?.id ?? guestCustomer?.id ?? null;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        customer_name: body.customer.name,
        customer_phone: body.customer.phone,
        customer_email: body.customer.email,
        delivery_address: body.customer.address,
        delivery_city: body.customer.city ?? null,
        delivery_state: body.customer.state ?? null,
        delivery_pincode: body.customer.pincode ?? null,
        subtotal: pricing.subtotal,
        discount_amount: pricing.discountAmount,
        loyalty_discount_amount: pricing.loyaltyDiscountAmount,
        shipping_charge: pricing.shippingCharge,
        total: pricing.total,
        payment_status: "unpaid",
        is_gift: body.isGift ?? false,
        gift_note: body.giftNote ?? null,
        customer_id: effectiveCustomerId,
        attributed_ad_brief_id:
          body.attributedAdBriefId && UUID_RE.test(body.attributedAdBriefId)
            ? body.attributedAdBriefId
            : null,
        referral_code_used: pricing.referral ? body.referralCode?.toUpperCase() : null,
        referral_discount_amount: pricing.referralDiscountAmount,
        coupon_code_used: pricing.coupon ? pricing.coupon.code : null,
        coupon_discount_amount: pricing.couponDiscountAmount,
      })
      .select()
      .single();

    if (orderError) throw orderError;

    const orderItems = pricing.items.map((item) => ({
      order_id: order.id,
      chapter_slug: item.slug,
      chapter_name: item.name,
      unit_price: item.price,
      quantity: item.quantity,
    }));
    const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
    if (itemsError) throw itemsError;

    await markCartSessionConverted(
      body.sessionKey,
      { id: order.id, customer_email: order.customer_email, customer_phone: order.customer_phone, total: pricing.total },
      // Unpaid WhatsApp order request — not a purchase until money arrives.
      { reportPurchaseToMeta: false }
    );

    if (body.newsletterOptIn != null) {
      await applyNewsletterOptIn(effectiveCustomerId, order.customer_email, body.newsletterOptIn);
    }

    // Team notification only; the invoice goes out when payment is confirmed.
    await Promise.allSettled([sendOrderNotificationEmail(order, orderItems)]);

    return NextResponse.json({ orderId: order.id });
  } catch (err) {
    console.error("Failed to save order", err);
    const msg = err instanceof Error && /Quantity|Invalid cart|Unknown chapter|pincode|Cash on Delivery/.test(err.message) ? err.message : "Could not save order";
    return NextResponse.json({ error: msg }, { status: msg === "Could not save order" ? 500 : 400 });
  }
}
