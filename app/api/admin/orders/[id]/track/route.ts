import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { trackShiprocketShipment } from "@/lib/shiprocket";

const STATUS_MAP: Record<string, string> = {
  "in transit": "shipped",
  delivered: "delivered",
  "out for delivery": "shipped",
  pickup: "processing",
};

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
    const shipmentStatus = tracking.status
      ? STATUS_MAP[tracking.status.toLowerCase()] ?? "processing"
      : "processing";

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
