import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";
import { sendWelcomeBack15Batch, sendWelcomeBack15ResendBatch } from "@/lib/email-campaigns";

export const maxDuration = 300;

async function assertAuthorized(request: Request) {
  const secret = await getSetting("CRON_SECRET");
  if (!secret) return true;
  const provided = new URL(request.url).searchParams.get("secret") ?? request.headers.get("x-cron-secret");
  return provided === secret;
}

/** Daily: next batch of the past-customer win-back email until everyone has it. */
export async function GET(request: Request) {
  if (!(await assertAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const first = await sendWelcomeBack15Batch();
  // Once everyone has had the first send, the same daily slot works through
  // the non-opener resend (from 3 Oct).
  if (first.remaining === 0) {
    return NextResponse.json({ first, resend: await sendWelcomeBack15ResendBatch() });
  }
  return NextResponse.json({ first });
}
