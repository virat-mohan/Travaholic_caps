import { NextResponse } from "next/server";
import { getCachedClarityInsights, syncClarityInsights, deriveFindings, getFindingStatuses, setFindingStatus, type FindingStatus } from "@/lib/clarity-insights";
import { getSetting } from "@/lib/settings";

/** Reads the last cached sync — never calls Clarity's API itself, so this is always safe to hit from a page load. */
export async function GET() {
  try {
    const [snapshot, callsToday, callsDate, statuses, projectId] = await Promise.all([
      getCachedClarityInsights(),
      getSetting("CLARITY_API_CALLS_TODAY"),
      getSetting("CLARITY_API_CALLS_DATE"),
      getFindingStatuses(),
      getSetting("CLARITY_PROJECT_ID"),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const usedToday = callsDate === today ? parseInt(callsToday ?? "0", 10) || 0 : 0;
    return NextResponse.json({
      snapshot,
      findings: snapshot ? deriveFindings(snapshot) : [],
      apiCallsUsedToday: usedToday,
      statuses,
      clarityProjectId: projectId,
    });
  } catch (err) {
    console.error("Failed to load cached UX insights", err);
    return NextResponse.json({ snapshot: null, findings: [], apiCallsUsedToday: 0 }, { status: 500 });
  }
}

/** Explicit "Sync Now" — counts against Clarity's 10-calls-a-day project-wide limit, see lib/clarity-insights.ts. */
export async function POST() {
  try {
    const snapshot = await syncClarityInsights(3);
    return NextResponse.json({ snapshot, findings: deriveFindings(snapshot) });
  } catch (err) {
    console.error("Failed to sync UX insights from Clarity", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Sync failed" }, { status: 500 });
  }
}

const STATUSES: FindingStatus[] = ["open", "fix_requested", "fixed", "ignored"];

/** Dashboard action on a finding: Request fix / Mark fixed / Ignore / Reopen. */
export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url : "";
  const status = body?.status as FindingStatus;
  if (!url || !STATUSES.includes(status)) {
    return NextResponse.json({ error: "url and a valid status are required" }, { status: 400 });
  }
  const statuses = await setFindingStatus(url, status, typeof body?.note === "string" ? body.note : undefined);
  return NextResponse.json({ statuses });
}
