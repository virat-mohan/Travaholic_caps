"use client";

import { useEffect, useState } from "react";

type UrlInsight = {
  url: string;
  sessions: number;
  rageClicks: number;
  deadClicks: number;
  scriptErrors: number;
  quickbacks: number;
  avgScrollDepth: number | null;
  avgEngagementTimeSeconds: number | null;
};

type Finding = { url: string; severity: "high" | "medium"; summary: string };

type Snapshot = { fetchedAt: string; numOfDays: number; urls: UrlInsight[] };

function formatFetchedAt(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function UxInsightsPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [apiCallsUsedToday, setApiCallsUsedToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/ux-insights")
      .then((res) => res.json())
      .then((data) => {
        setSnapshot(data.snapshot ?? null);
        setFindings(data.findings ?? []);
        setApiCallsUsedToday(data.apiCallsUsedToday ?? 0);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function syncNow() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ux-insights", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setSnapshot(data.snapshot);
      setFindings(data.findings ?? []);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1100px] px-6 pt-28 pb-24 md:px-12">
      <h1 className="mt-2 font-display text-heading-l uppercase text-ink">UX Insights</h1>
      <p className="mt-2 max-w-2xl text-body-s text-secondary-text">
        Aggregated behavior data pulled from Microsoft Clarity — rage clicks, dead clicks, and JS
        errors per page, the signals that actually point at broken or frustrating UI. This never
        calls Clarity live on page load; it only ever reads a cached snapshot. Clarity caps every
        project at 10 API calls a day, so use &quot;Sync Now&quot; sparingly — a daily background
        sync keeps this reasonably fresh on its own.
      </p>
      <p className="mt-3 text-caption text-secondary-text">
        Clarity API calls used today: {apiCallsUsedToday} / 10
        {snapshot && <> · Last synced {formatFetchedAt(snapshot.fetchedAt)} (last {snapshot.numOfDays} day{snapshot.numOfDays === 1 ? "" : "s"})</>}
      </p>

      <button
        onClick={syncNow}
        disabled={syncing || apiCallsUsedToday >= 10}
        className="mt-4 border border-ink px-5 py-2 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink transition-colors duration-300 hover:bg-ink hover:text-cream disabled:opacity-50"
      >
        {syncing ? "Syncing..." : apiCallsUsedToday >= 10 ? "Daily Clarity Quota Used" : "Sync Now"}
      </button>
      {error && <p className="mt-3 text-body-s text-paint-orange">{error}</p>}

      {loading ? (
        <p className="mt-8 text-body-s text-secondary-text">Loading...</p>
      ) : !snapshot ? (
        <p className="mt-8 text-body-s text-secondary-text">
          No data synced yet. Add a Clarity API token in /admin/settings, then click &quot;Sync
          Now&quot; above.
        </p>
      ) : (
        <>
          <section className="mt-10">
            <h2 className="font-display text-heading-s uppercase text-ink">
              What Needs Attention ({findings.length})
            </h2>
            {findings.length === 0 ? (
              <p className="mt-3 text-body-s text-secondary-text">
                Nothing flagged in the last {snapshot.numOfDays} day{snapshot.numOfDays === 1 ? "" : "s"} — no
                page crossed the rage-click/dead-click/JS-error thresholds.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {findings.map((f) => (
                  <div
                    key={f.url}
                    className={`border p-4 ${f.severity === "high" ? "border-paint-orange" : "border-tan-gold"}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-micro font-bold uppercase tracking-[0.05em] ${
                          f.severity === "high" ? "text-paint-orange" : "text-tan-gold"
                        }`}
                      >
                        {f.severity === "high" ? "High Priority" : "Worth A Look"}
                      </span>
                      <span className="font-sans text-body-s text-ink">{f.url}</span>
                    </div>
                    <p className="mt-1.5 text-caption text-secondary-text">{f.summary}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="mt-10">
            <h2 className="font-display text-heading-s uppercase text-ink">All Pages</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[700px] text-left">
                <thead>
                  <tr className="border-b border-divider text-caption uppercase tracking-[0.05em] text-secondary-text">
                    <th className="py-2 pr-4">Page</th>
                    <th className="py-2 pr-4">Sessions</th>
                    <th className="py-2 pr-4">Rage Clicks</th>
                    <th className="py-2 pr-4">Dead Clicks</th>
                    <th className="py-2 pr-4">JS Errors</th>
                    <th className="py-2 pr-4">Quickbacks</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.urls.map((u) => (
                    <tr key={u.url} className="border-b border-divider">
                      <td className="max-w-[320px] truncate py-2 pr-4 text-body-s text-ink" title={u.url}>
                        {u.url}
                      </td>
                      <td className="py-2 pr-4 text-body-s text-ink">{u.sessions}</td>
                      <td className="py-2 pr-4 text-body-s text-ink">{u.rageClicks}</td>
                      <td className="py-2 pr-4 text-body-s text-ink">{u.deadClicks}</td>
                      <td className="py-2 pr-4 text-body-s text-ink">{u.scriptErrors}</td>
                      <td className="py-2 pr-4 text-body-s text-ink">{u.quickbacks}</td>
                    </tr>
                  ))}
                  {snapshot.urls.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-body-s text-secondary-text">
                        No per-page data in this snapshot.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
