import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { applyShipmentStatusUpdate } from "@/lib/shiprocket-status";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Missing body" }, { status: 400 });

  // refund_status is intentionally not editable here — it's set only by an
  // actual refund/cancel firing or the courier-status webhook confirming
  // money moved, so hand-editing it would let the label lie about whether
  // money actually moved.
  const patch: Record<string, string> = {};
  if (body.status) patch.status = body.status;

  if (Object.keys(patch).length === 0 && !body.shipmentStatus) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    if (Object.keys(patch).length > 0) {
      const { error } = await supabase.from("orders").update(patch).eq("id", id);
      if (error) throw error;
    }

    if (body.shipmentStatus) {
      // Manual override for orders shipped outside the normal Shiprocket
      // flow, or when tracking hasn't caught up yet — goes through the same
      // function the real webhook uses, so "Delivered" still fires the
      // review-request nudge exactly once and "Cancelled" triggers no
      // refund/restock (that keyword matches none of the RTO/NDR/delivered
      // regexes there), consistent with a forfeited COD advance.
      await applyShipmentStatusUpdate({ orderId: id, status: body.shipmentStatus });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to update order", err);
    return NextResponse.json({ error: "Could not update order" }, { status: 500 });
  }
}
