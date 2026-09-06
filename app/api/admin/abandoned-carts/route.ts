import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

/** Lists recent active/abandoned cart sessions for the admin to review and, if needed, retarget one manually. */
export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("cart_sessions")
      .select(
        "id, customer_name, customer_email, customer_phone, items, subtotal, status, retargeted_at, last_activity_at, created_at, abandon_reason, abandon_reason_note, abandon_reason_at"
      )
      .in("status", ["active", "abandoned"])
      .order("last_activity_at", { ascending: false })
      .limit(50);
    if (error) throw error;

    // Reason counts cover every session that ever answered, regardless of
    // status (a cart can convert after answering, or fall outside the
    // 50-row window above) — a separate, unlimited query keeps that count
    // accurate independent of the list pagination.
    const { data: reasonRows, error: reasonError } = await supabase
      .from("cart_sessions")
      .select("abandon_reason")
      .not("abandon_reason", "is", null);
    if (reasonError) throw reasonError;

    const reasonCounts: Record<string, number> = {};
    for (const row of reasonRows ?? []) {
      const reason = row.abandon_reason as string;
      reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
    }

    return NextResponse.json({ sessions: data ?? [], reasonCounts });
  } catch (err) {
    console.error("Failed to list cart sessions", err);
    return NextResponse.json({ sessions: [], reasonCounts: {} }, { status: 500 });
  }
}
