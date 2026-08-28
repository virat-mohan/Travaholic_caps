import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.active !== "boolean") {
    return NextResponse.json({ error: "Missing active flag" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("coupon_codes").update({ active: body.active }).eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to update coupon", err);
    return NextResponse.json({ error: "Could not update coupon" }, { status: 500 });
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("coupon_redemptions")
      .select("id, order_id, customer_phone, customer_email, discount_amount, redeemed_at")
      .eq("coupon_id", id)
      .order("redeemed_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ redemptions: data ?? [] });
  } catch (err) {
    console.error("Failed to load redemptions", err);
    return NextResponse.json({ error: "Could not load redemptions" }, { status: 500 });
  }
}
