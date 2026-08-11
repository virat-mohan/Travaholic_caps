import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.sessionKey) {
    return NextResponse.json({ error: "Missing sessionKey" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const { data: existing } = await supabase
      .from("cart_sessions")
      .select("id, status")
      .eq("session_key", body.sessionKey)
      .maybeSingle();

    // Never resurrect a converted/abandoned session back to active just
    // because the browser tab is still open and re-fires a debounced save.
    const status = existing && existing.status !== "active" ? existing.status : "active";

    const { error } = await supabase.from("cart_sessions").upsert(
      {
        session_key: body.sessionKey,
        customer_name: body.name || null,
        customer_phone: body.phone || null,
        customer_email: body.email || null,
        items: body.items ?? [],
        subtotal: body.subtotal ?? null,
        status,
        last_activity_at: new Date().toISOString(),
      },
      { onConflict: "session_key" }
    );
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to save cart session", err);
    return NextResponse.json({ error: "Could not save cart session" }, { status: 500 });
  }
}
