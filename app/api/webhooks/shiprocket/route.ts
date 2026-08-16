import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";
import { getSupabaseServerClient } from "@/lib/supabase";

/**
 * Shiprocket calls this on every shipment status change (Settings -> API ->
 * Webhooks in their dashboard), so the dashboard's shipment status updates
 * live instead of needing a manual "Refresh Tracking" click.
 *
 * Payload field names below follow Shiprocket's documented webhook shape,
 * but — like the Meta/MSG91 integrations earlier — this hasn't been
 * exercised against a real delivered webhook yet. Logs the raw body on
 * anything unrecognized so the first live event is easy to diagnose rather
 * than silently dropped. Always returns 200 quickly so Shiprocket doesn't
 * retry-storm on a downstream hiccup.
 */
export async function POST(request: Request) {
  const expectedToken = await getSetting("SHIPROCKET_WEBHOOK_TOKEN");
  const providedToken = request.headers.get("x-api-key");
  if (expectedToken && providedToken !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: true });

  // Shiprocket echoes back whatever we sent as `order_id` when the shipment
  // was created — that's our own orders.id (see createShiprocketOrder in
  // lib/shiprocket.ts), so it's the most reliable match. Fall back to AWB
  // or their internal shipment id if the order_id field isn't present.
  const ourOrderId = body.order_id ?? body.channel_order_id ?? null;
  const awbCode = body.awb ?? body.awb_code ?? null;
  const shipmentId = body.shipment_id ? String(body.shipment_id) : null;
  const status = body.current_status ?? body.shipment_status ?? body.status ?? null;
  const courierName = body.courier_name ?? null;

  if (!status || (!ourOrderId && !awbCode && !shipmentId)) {
    console.error("Shiprocket webhook: unrecognized payload shape", JSON.stringify(body));
    return NextResponse.json({ ok: true });
  }

  try {
    const supabase = getSupabaseServerClient();
    const patch: Record<string, string> = { shipment_status: String(status).toLowerCase() };
    if (awbCode) patch.shiprocket_awb_code = awbCode;
    if (courierName) patch.courier_name = courierName;

    let query = supabase.from("orders").update(patch);
    if (ourOrderId) query = query.eq("id", ourOrderId);
    else if (shipmentId) query = query.eq("shiprocket_shipment_id", shipmentId);
    else query = query.eq("shiprocket_awb_code", awbCode);

    const { data, error } = await query.select("id");
    if (error) throw error;
    if (!data || data.length === 0) {
      console.error("Shiprocket webhook: no matching order for", { ourOrderId, awbCode, shipmentId });
    }
  } catch (err) {
    console.error("Shiprocket webhook handling failed", err);
  }

  return NextResponse.json({ ok: true });
}
