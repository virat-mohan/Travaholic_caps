import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { verifyRazorpaySignature } from "@/lib/razorpay";
import { sendInvoiceEmail } from "@/lib/email";
import { sendOrderConfirmationWhatsApp } from "@/lib/whatsapp-notify";
import { markCartSessionConverted } from "@/lib/cart-session-convert";

type OrderPayload = {
  customer: { name: string; phone: string; email: string; address: string };
  items: { slug: string; name: string; price: number; quantity: number }[];
  subtotal: number;
  discountAmount?: number;
  total?: number;
  isGift?: boolean;
  giftNote?: string | null;
  sessionKey?: string;
};

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

    const supabase = getSupabaseServerClient();
    const discountAmount = payload.discountAmount ?? 0;
    const total = payload.total ?? payload.subtotal - discountAmount;

    const { data: savedOrder, error: orderError } = await supabase
      .from("orders")
      .insert({
        customer_name: payload.customer.name,
        customer_phone: payload.customer.phone,
        customer_email: payload.customer.email,
        delivery_address: payload.customer.address,
        subtotal: payload.subtotal,
        discount_amount: discountAmount,
        total,
        is_gift: payload.isGift ?? false,
        gift_note: payload.giftNote ?? null,
        status: "confirmed",
        payment_status: "paid",
        razorpay_order_id,
        razorpay_payment_id,
      })
      .select()
      .single();

    if (orderError) throw orderError;

    const orderItems = payload.items.map((item) => ({
      order_id: savedOrder.id,
      chapter_slug: item.slug,
      chapter_name: item.name,
      unit_price: item.price,
      quantity: item.quantity,
    }));

    const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
    if (itemsError) throw itemsError;

    for (const item of payload.items) {
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

    // Best-effort — a failed email/WhatsApp send shouldn't fail the order.
    await Promise.allSettled([
      sendInvoiceEmail(savedOrder, orderItems),
      sendOrderConfirmationWhatsApp(savedOrder),
    ]);

    await markCartSessionConverted(payload.sessionKey, {
      id: savedOrder.id,
      customer_email: savedOrder.customer_email,
      customer_phone: savedOrder.customer_phone,
      total,
    });

    return NextResponse.json({ orderId: savedOrder.id });
  } catch (err) {
    console.error("Failed to verify/save Razorpay order", err);
    return NextResponse.json({ error: "Could not complete order" }, { status: 500 });
  }
}
