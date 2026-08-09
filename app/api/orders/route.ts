import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

type OrderPayload = {
  customer: { name: string; phone: string; email: string; address: string };
  items: { slug: string; name: string; price: number; quantity: number }[];
  subtotal: number;
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

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        customer_name: body.customer.name,
        customer_phone: body.customer.phone,
        customer_email: body.customer.email,
        delivery_address: body.customer.address,
        subtotal: body.subtotal,
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

    return NextResponse.json({ orderId: order.id });
  } catch (err) {
    console.error("Failed to save order", err);
    return NextResponse.json({ error: "Could not save order" }, { status: 500 });
  }
}
