import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";
import { runPerformanceSweep } from "@/lib/performance-manager";

export const maxDuration = 300;

async function assertAuthorized(request: Request) {
  const secret = await getSetting("CRON_SECRET");
  if (!secret) return true;
  const provided = new URL(request.url).searchParams.get("secret") ?? request.headers.get("x-cron-secret");
  return provided === secret;
}

export async function GET(request: Request) {
  if (!(await assertAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runPerformanceSweep();
    return NextResponse.json(result);
  } catch (err) {
    console.error("Performance manager sweep failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Sweep failed" }, { status: 500 });
  }
}
