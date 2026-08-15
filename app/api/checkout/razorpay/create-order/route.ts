import { NextResponse } from "next/server";
import { createRazorpayOrder } from "@/lib/razorpay";
import { computeTrustedOrderTotal } from "@/lib/order-pricing";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.items?.length) {
    return NextResponse.json({ error: "Missing items" }, { status: 400 });
  }

  try {
    const pricing = await computeTrustedOrderTotal(body.items, body.redeemMilesRupees, body.pincode);
    if (pricing.total <= 0) {
      return NextResponse.json({ error: "Order total must be greater than zero" }, { status: 400 });
    }

    const { razorpayOrderId, keyId } = await createRazorpayOrder(
      pricing.total,
      `travaholic_${Date.now()}`
    );

    return NextResponse.json({
      razorpayOrderId,
      keyId,
      subtotal: pricing.subtotal,
      discountAmount: pricing.discountAmount,
      loyaltyDiscountAmount: pricing.loyaltyDiscountAmount,
      shippingCharge: pricing.shippingCharge,
      total: pricing.total,
    });
  } catch (err) {
    console.error("Failed to create Razorpay order", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not create Razorpay order" },
      { status: 500 }
    );
  }
}
