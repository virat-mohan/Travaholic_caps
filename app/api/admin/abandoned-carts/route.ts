import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

/** Lists recent active/abandoned cart sessions for the admin to review and, if needed, retarget one manually. */
export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("cart_sessions")
      .select("id, customer_name, customer_email, customer_phone, items, subtotal, status, retargeted_at, last_activity_at, created_at")
      .in("status", ["active", "abandoned"])
      .order("last_activity_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return NextResponse.json({ sessions: data ?? [] });
  } catch (err) {
    console.error("Failed to list cart sessions", err);
    return NextResponse.json({ sessions: [] }, { status: 500 });
  }
}
