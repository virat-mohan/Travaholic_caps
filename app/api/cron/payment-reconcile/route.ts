import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";
import { reconcileCapturedPayments } from "@/lib/payment-reconcile";

export const maxDuration = 120;

async function assertAuthorized(request: Request) {
  const secret = await getSetting("CRON_SECRET");
  if (!secret) return true;
  const provided = new URL(request.url).searchParams.get("secret") ?? request.headers.get("x-cron-secret");
  return provided === secret;
}

/** Every few minutes (Supabase pg_cron) + daily (Vercel): no captured payment is ever left without an order. */
export async function GET(request: Request) {
  if (!(await assertAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await reconcileCapturedPayments());
}
