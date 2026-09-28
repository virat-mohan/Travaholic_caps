import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";
import { runCheckoutHealthCheck } from "@/lib/checkout-health";
import { reconcilePaidPaymentLinks } from "@/lib/upi-qr-fulfillment";

async function assertAuthorized(request: Request) {
  const secret = await getSetting("CRON_SECRET");
  if (!secret) return true;
  const provided = new URL(request.url).searchParams.get("secret") ?? request.headers.get("x-cron-secret");
  return provided === secret;
}

/** Daily sweep behind the real-time payment.failed webhook tripwire. */
export async function GET(request: Request) {
  if (!(await assertAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const recoveredOrders = await reconcilePaidPaymentLinks();
  const health = await runCheckoutHealthCheck("daily cron");
  return NextResponse.json({ ...health, recoveredOrders });
}
