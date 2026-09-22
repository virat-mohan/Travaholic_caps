import { getSetting, setSetting } from "@/lib/settings";

const CLARITY_API_URL = "https://www.clarity.ms/export-data/api/v1/project-live-insights";
const DAILY_CALL_LIMIT = 10; // Clarity's own hard cap per project per day

type ClarityMetricRow = Record<string, string | number> & { URL?: string };
type ClarityApiResponse = { metricName: string; information: ClarityMetricRow[] }[];

export type UrlInsight = {
  url: string;
  sessions: number;
  rageClicks: number;
  deadClicks: number;
  scriptErrors: number;
  quickbacks: number;
  avgScrollDepth: number | null;
  avgEngagementTimeSeconds: number | null;
};

export type ClaritySnapshot = {
  fetchedAt: string;
  numOfDays: number;
  urls: UrlInsight[];
};

function toNumber(v: string | number | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Merges Clarity's per-metric response blocks (each metricName has its own
 * `information` array, one row per URL when dimension1=URL) into one row
 * per URL — the shape /admin/website-insights actually wants to render.
 * Clarity's field names inside each metric block aren't fully documented
 * (the docs sample only shows the "Traffic" metric's shape), so this reads
 * defensively across the field-name variants that show up in practice
 * rather than assuming one fixed schema.
 */
function summarize(raw: ClarityApiResponse, numOfDays: number): ClaritySnapshot {
  const byUrl = new Map<string, UrlInsight>();
  function row(url: string): UrlInsight {
    const existing = byUrl.get(url);
    if (existing) return existing;
    const fresh: UrlInsight = {
      url,
      sessions: 0,
      rageClicks: 0,
      deadClicks: 0,
      scriptErrors: 0,
      quickbacks: 0,
      avgScrollDepth: null,
      avgEngagementTimeSeconds: null,
    };
    byUrl.set(url, fresh);
    return fresh;
  }

  for (const block of raw) {
    for (const info of block.information ?? []) {
      const url = info.URL;
      if (!url || typeof url !== "string") continue;
      const r = row(url);

      switch (block.metricName) {
        case "Traffic":
          r.sessions = Math.max(r.sessions, toNumber(info.totalSessionCount));
          break;
        case "RageClickCount":
          r.rageClicks = toNumber(info.RageClickCount ?? info.totalRageClickCount ?? info.subTotal);
          break;
        case "DeadClickCount":
          r.deadClicks = toNumber(info.DeadClickCount ?? info.totalDeadClickCount ?? info.subTotal);
          break;
        case "ScriptErrorCount":
          r.scriptErrors = toNumber(info.ScriptErrorCount ?? info.totalScriptErrorCount ?? info.subTotal);
          break;
        case "QuickbackClick":
          r.quickbacks = toNumber(info.QuickbackClick ?? info.totalQuickbackCount ?? info.subTotal);
          break;
        case "ScrollDepth":
          r.avgScrollDepth = toNumber(info.averageScrollDepth ?? info.ScrollDepth ?? info.subTotal);
          break;
        case "EngagementTime":
          r.avgEngagementTimeSeconds = toNumber(info.averageEngagementTime ?? info.EngagementTime ?? info.subTotal);
          break;
        default:
          break;
      }
    }
  }

  return {
    fetchedAt: new Date().toISOString(),
    numOfDays,
    urls: [...byUrl.values()].sort((a, b) => b.rageClicks + b.deadClicks - (a.rageClicks + a.deadClicks)),
  };
}

async function checkAndBumpQuota(): Promise<{ ok: boolean; callsToday: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const [storedDate, storedCount] = await Promise.all([
    getSetting("CLARITY_API_CALLS_DATE"),
    getSetting("CLARITY_API_CALLS_TODAY"),
  ]);
  const callsToday = storedDate === today ? parseInt(storedCount ?? "0", 10) || 0 : 0;
  if (callsToday >= DAILY_CALL_LIMIT) return { ok: false, callsToday };

  await Promise.all([
    setSetting("CLARITY_API_CALLS_DATE", today),
    setSetting("CLARITY_API_CALLS_TODAY", String(callsToday + 1)),
  ]);
  return { ok: true, callsToday: callsToday + 1 };
}

/**
 * Pulls fresh insights from Clarity's Data Export API and caches the
 * summarized result in app_settings — this must never be called from a
 * page load or admin-panel render, only from an explicit "Sync Now" click
 * or the once-daily cron (see app/api/cron/clarity-sync). Clarity caps
 * every project at 10 API calls per day total, project-wide, and that
 * ceiling is trivial to blow through if this were ever called on-demand
 * per request.
 */
export async function syncClarityInsights(numOfDays: 1 | 2 | 3 = 3): Promise<ClaritySnapshot> {
  const token = await getSetting("CLARITY_API_TOKEN");
  if (!token) {
    throw new Error("CLARITY_API_TOKEN is not set — add it in /admin/settings first (Clarity → Settings → Data Export → Generate new API token)");
  }

  const quota = await checkAndBumpQuota();
  if (!quota.ok) {
    throw new Error(
      `Clarity's own limit is 10 API calls per project per day, and that's already been used up today (${quota.callsToday}/${DAILY_CALL_LIMIT}) — try again after midnight UTC, when Clarity resets it.`
    );
  }

  const res = await fetch(
    `${CLARITY_API_URL}?numOfDays=${numOfDays}&dimension1=URL`,
    { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Clarity API request failed: ${res.status} ${body.slice(0, 300)}`);
  }
  const raw = (await res.json()) as ClarityApiResponse;
  const snapshot = summarize(raw, numOfDays);

  await Promise.all([
    setSetting("CLARITY_INSIGHTS_SNAPSHOT", JSON.stringify(snapshot)),
    setSetting("CLARITY_INSIGHTS_SYNCED_AT", snapshot.fetchedAt),
  ]);

  return snapshot;
}

/** Reads the last cached snapshot without making any Clarity API call — this is what every page/admin view should use. */
export async function getCachedClarityInsights(): Promise<ClaritySnapshot | null> {
  const raw = await getSetting("CLARITY_INSIGHTS_SNAPSHOT");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ClaritySnapshot;
  } catch {
    return null;
  }
}

const RAGE_CLICK_FLAG_THRESHOLD = 3;
const DEAD_CLICK_FLAG_THRESHOLD = 3;
const SCRIPT_ERROR_FLAG_THRESHOLD = 1;

export type InsightFinding = {
  url: string;
  severity: "high" | "medium";
  summary: string;
};

/**
 * Turns the raw per-URL counts into a plain-English punch list — the
 * "what action needs to be taken" half of the ask, not just a numbers
 * dump. Thresholds are deliberately low (a handful of rage clicks on a
 * low-traffic page is still worth a look) since a false positive here just
 * costs someone a glance at a page, while a missed real one costs a
 * conversion.
 */
export function deriveFindings(snapshot: ClaritySnapshot): InsightFinding[] {
  const findings: InsightFinding[] = [];
  for (const u of snapshot.urls) {
    const issues: string[] = [];
    if (u.rageClicks >= RAGE_CLICK_FLAG_THRESHOLD) {
      issues.push(`${u.rageClicks} rage clicks (repeated frustrated clicking — usually a button/link that looks clickable but isn't responding)`);
    }
    if (u.deadClicks >= DEAD_CLICK_FLAG_THRESHOLD) {
      issues.push(`${u.deadClicks} dead clicks (clicks on something that does nothing — check for a missing handler or a disabled-looking element)`);
    }
    if (u.scriptErrors >= SCRIPT_ERROR_FLAG_THRESHOLD) {
      issues.push(`${u.scriptErrors} JS errors (a real bug throwing in the browser on this page)`);
    }
    if (issues.length === 0) continue;
    const severity: InsightFinding["severity"] = u.scriptErrors > 0 || u.rageClicks >= 8 ? "high" : "medium";
    findings.push({ url: u.url, severity, summary: issues.join("; ") });
  }
  return findings.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "high" ? -1 : 1));
}
