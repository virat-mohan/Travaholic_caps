import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";
import { getSupabaseServerClient } from "@/lib/supabase";
import { trackShiprocketShipment } from "@/lib/shiprocket";
import { applyShipmentStatusUpdate } from "@/lib/shiprocket-status";

async function assertAuthorized(request: Request) {
  const secret = await getSetting("CRON_SECRET");
  if (!secret) return true;
  const provided = new URL(request.url).searchParams.get("secret") ?? request.headers.get("x-cron-secret");
  return provided === secret;
}

/**
 * Self-healing fallback for the Shiprocket webhook: polls every shipment
 * that isn't in a terminal state and re-applies whatever status Shiprocket
 * currently reports, through the exact same logic the webhook uses (see
 * lib/shiprocket-status.ts) — so a shipment stays fresh in the dashboard
 * even if the webhook was never registered on Shiprocket's side, was
 * misconfigured, or silently dropped an event. Every write is guarded by a
 * transition check, so re-applying an unchanged status is always a no-op.
 */
export async function GET(request: Request) {
  if (!(await assertAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  // Bounded to recent orders with a real shipment and a non-terminal status
  // — "delivered" also matches "RTO Delivered", the terminal state on that
  // branch, so excluding anything containing it covers both end states.
  const sinceCutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, shiprocket_shipment_id, shiprocket_awb_code, shipment_status, created_at")
    .not("shiprocket_shipment_id", "is", null)
    .not("shipment_status", "ilike", "%delivered%")
    .neq("status", "cancelled")
    .gte("created_at", sinceCutoff)
    .limit(200);
  if (error) {
    console.error("Failed to load shipments to sweep", error);
    return NextResponse.json({ error: "Could not load shipments" }, { status: 500 });
  }

  const results: { orderId: string; ok: boolean; status?: string; error?: string }[] = [];
  for (const order of orders ?? []) {
    try {
      const tracking = await trackShiprocketShipment(order.shiprocket_shipment_id as string, order.shiprocket_awb_code as string | null);
      if (!tracking.status) {
        results.push({ orderId: order.id, ok: true, status: "(no update from Shiprocket)" });
        continue;
      }
      await applyShipmentStatusUpdate({
        orderId: order.id,
        status: tracking.status,
        awbCode: tracking.awbCode,
        courierName: tracking.courierName,
        // Orders older than 7 days are a backfill: update quietly, no late customer messages.
        quiet: Date.now() - new Date(order.created_at as string).getTime() > 7 * 24 * 60 * 60 * 1000,
      });
      results.push({ orderId: order.id, ok: true, status: tracking.status });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`Track sweep failed for order ${order.id}`, err);
      results.push({ orderId: order.id, ok: false, error: message });
    }
  }

  return NextResponse.json({ swept: results.length, results });
}
