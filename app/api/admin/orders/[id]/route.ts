import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Missing body" }, { status: 400 });

  // shipment_status and refund_status are intentionally not editable here —
  // shipment_status is set only by the Shiprocket webhook and "Refresh
  // Tracking"; refund_status is set only by an actual refund/cancel firing
  // or the courier-status webhook confirming money moved. Letting an admin
  // hand-edit either would let the label lie about what actually happened.
  const patch: Record<string, string> = {};
  if (body.status) patch.status = body.status;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("orders").update(patch).eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to update order", err);
    return NextResponse.json({ error: "Could not update order" }, { status: 500 });
  }
}
