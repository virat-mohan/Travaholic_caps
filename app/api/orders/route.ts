import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
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
    const discountAmount = body.discountAmount ?? 0;
    const total = body.total ?? body.subtotal - discountAmount;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        customer_name: body.customer.name,
        customer_phone: body.customer.phone,
        customer_email: body.customer.email,
        delivery_address: body.customer.address,
        subtotal: body.subtotal,
        discount_amount: discountAmount,
        total,
        is_gift: body.isGift ?? false,
        gift_note: body.giftNote ?? null,
      })
      .select()
      .single();

    if (orderError) throw orderError;

    const { error: itemsError } = await supabase.from("order_items").insert(
      body.items.map((item) => ({
        order_id: order.id,
        chapter_slug: item.slug,
        chapter_name: item.name,
        unit_price: item.price,
        quantity: item.quantity,
      }))
    );

    if (itemsError) throw itemsError;

    // Decrement inventory. Best-effort — a failed decrement shouldn't fail the order.
    for (const item of body.items) {
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

    await markCartSessionConverted(body.sessionKey, {
      id: order.id,
      customer_email: order.customer_email,
      customer_phone: order.customer_phone,
      total,
    });

    return NextResponse.json({ orderId: order.id });
  } catch (err) {
    console.error("Failed to save order", err);
    return NextResponse.json({ error: "Could not save order" }, { status: 500 });
  }
}
