import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.chapterSlug || typeof body.stockOnHand !== "number") {
    return NextResponse.json({ error: "Missing chapterSlug or stockOnHand" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from("inventory")
      .upsert({ chapter_slug: body.chapterSlug, stock_on_hand: body.stockOnHand, updated_at: new Date().toISOString() });

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to update inventory", err);
    return NextResponse.json({ error: "Could not update inventory" }, { status: 500 });
  }
}
