import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";
import { syncClarityInsights } from "@/lib/clarity-insights";

async function assertAuthorized(request: Request) {
  const secret = await getSetting("CRON_SECRET");
  if (!secret) return true;
  const provided = new URL(request.url).searchParams.get("secret") ?? request.headers.get("x-cron-secret");
  return provided === secret;
}

/**
 * Once-a-day refresh of the cached Clarity insights snapshot (see
 * lib/clarity-insights.ts) — /admin/ux-insights only ever reads the cache,
 * never calls Clarity live, so this (plus the page's own manual "Sync Now"
 * button) is the only thing that consumes Clarity's 10-calls-per-day quota.
 * Run this at most once a day; hitting it more than a handful of times
 * will exhaust the quota before a human even gets to click Sync Now.
 */
export async function GET(request: Request) {
  if (!(await assertAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const snapshot = await syncClarityInsights(3);
    return NextResponse.json({ ok: true, urls: snapshot.urls.length });
  } catch (err) {
    console.error("Clarity sync failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Sync failed" }, { status: 500 });
  }
}
