import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { trackShiprocketShipment } from "@/lib/shiprocket";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const supabase = getSupabaseServerClient();
    const { data: order } = await supabase
      .from("orders")
      .select("shiprocket_shipment_id")
      .eq("id", id)
      .maybeSingle();
    if (!order?.shiprocket_shipment_id) {
      return NextResponse.json({ error: "No shipment on this order yet" }, { status: 400 });
    }

    const tracking = await trackShiprocketShipment(order.shiprocket_shipment_id);
    // Store Shiprocket's own status string verbatim (same convention the
    // webhook uses) rather than squeezing it into a fixed enum — so this
    // manual refresh and the live webhook always agree on what's displayed.
    const shipmentStatus = tracking.status ? tracking.status.toLowerCase() : "processing";

    const { error } = await supabase
      .from("orders")
      .update({
        shipment_status: shipmentStatus,
        shiprocket_awb_code: tracking.awbCode,
        courier_name: tracking.courierName,
      })
      .eq("id", id);
    if (error) throw error;

    return NextResponse.json({ ok: true, ...tracking, shipmentStatus });
  } catch (err) {
    console.error("Failed to track Shiprocket shipment", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not check tracking" },
      { status: 500 }
    );
  }
}
