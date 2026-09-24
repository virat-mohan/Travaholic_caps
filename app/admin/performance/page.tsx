"use client";

import { useEffect, useState } from "react";

type Snapshot = { date: string; adsetId: string; adsetName: string; campaignId: string; spend: number; purchases: number; purchaseValue: number; roas: number | null; linkClicks: number };
type Action = { at: string; entityName: string; action: string; reason: string; before?: string; after?: string };
type Experiment = { id: string; name: string; hypothesis: string; status: string; targetingKind: string; creativeKind: string; resultNote?: string; launchedAt?: string };
type Overview = {
  config: { enabled: boolean; capRupees: number; targetRoas: number; managedCampaignIds: string[]; audiences: Record<string, string>; alertWhatsApp: string | null; alertEmails: string[] };
  state: { snapshots: Snapshot[]; actions: Action[]; experiments: Experiment[]; suggestions: { at: string; text: string }[]; halted: boolean; lastSweepAt?: string; productSetId?: string };
  activeCampaigns: { id: string; name: string; dailyBudgetRupees: number | null }[];
  audienceSizes: Record<string, { name: string; lower: number; upper: number; status: number | null }>;
};

function money(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export default function PerformancePage() {
  const [data, setData] = useState<Overview | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/performance")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setMessage("Could not load"));
  }
  useEffect(load, []);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/performance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setMessage(action === "sweep" && Array.isArray(json.decisions) ? (json.decisions.join(" | ") || "Sweep done — no changes needed.") : `${action} done.`);
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  if (!data) return <main className="mx-auto w-full max-w-[1100px] px-6 pt-28 md:px-12"><p className="text-body-s text-secondary-text">Loading…</p></main>;

  const { config, state } = data;
  const managedSnapshots = state.snapshots.filter((s) => config.managedCampaignIds.includes(s.campaignId));
  const dates = [...new Set(managedSnapshots.map((s) => s.date))].sort().slice(-7);
  const adsets = [...new Map(managedSnapshots.map((s) => [s.adsetId, s.adsetName])).entries()];
  const totalsByDate = dates.map((d) => {
    const rows = managedSnapshots.filter((s) => s.date === d);
    const spend = rows.reduce((a, r) => a + r.spend, 0);
    const value = rows.reduce((a, r) => a + r.purchaseValue, 0);
    return { d, spend, purchases: rows.reduce((a, r) => a + r.purchases, 0), roas: spend ? value / spend : null };
  });

  return (
    <main className="mx-auto w-full max-w-[1100px] px-6 pt-28 pb-24 md:px-12">
      <h1 className="font-display text-heading-l uppercase text-ink">Performance Manager</h1>
      <p className="mt-2 max-w-2xl text-body-s text-secondary-text">
        Runs daily at 8am IST. Pauses any managed ad set under {config.targetRoas}x for 3 days straight, halts the campaign if the blend is under {config.targetRoas}x for 3 days,
        scales winners within the ₹{config.capRupees}/day cap, and keeps launching the next queued audience experiment.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button onClick={() => act("config", { enabled: !config.enabled })} disabled={!!busy} className={`border px-4 py-2 font-sans text-caption font-bold uppercase tracking-[0.05em] ${config.enabled ? "border-ink bg-ink text-cream" : "border-ink text-ink"}`}>
          {config.enabled ? "Manager: ON" : "Manager: OFF"}
        </button>
        <button onClick={() => act("bootstrap")} disabled={!!busy} className="border border-ink px-4 py-2 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink hover:bg-ink hover:text-cream disabled:opacity-50">
          {busy === "bootstrap" ? "Launching…" : config.managedCampaignIds.length ? "Re-run Bootstrap (fill gaps)" : "Bootstrap: audiences + launch campaign"}
        </button>
        <button onClick={() => act("sweep")} disabled={!!busy} className="border border-ink px-4 py-2 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink hover:bg-ink hover:text-cream disabled:opacity-50">
          {busy === "sweep" ? "Running…" : "Run sweep now"}
        </button>
        <button onClick={() => act("ideas")} disabled={!!busy} className="border border-ink px-4 py-2 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink hover:bg-ink hover:text-cream disabled:opacity-50">
          {busy === "ideas" ? "Thinking…" : "Generate new experiments"}
        </button>
        {config.managedCampaignIds.length > 0 && (
          <button onClick={() => act("campaign_status", { status: state.halted ? "ACTIVE" : "PAUSED" })} disabled={!!busy} className="border border-paint-orange px-4 py-2 font-sans text-caption font-bold uppercase tracking-[0.05em] text-paint-orange disabled:opacity-50">
            {state.halted ? "Resume managed campaign" : "Pause managed campaign"}
          </button>
        )}
      </div>
      {message && <p className="mt-3 text-body-s text-ink">{message}</p>}
      <p className="mt-2 text-caption text-secondary-text">
        Managed campaign: {config.managedCampaignIds[0] ?? "none yet"} · Last sweep: {state.lastSweepAt ? new Date(state.lastSweepAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "never"} · Product set: {state.productSetId ?? "—"}
        {state.halted && <span className="ml-2 font-bold text-paint-orange">HALTED</span>}
      </p>

      <section className="mt-10">
        <h2 className="font-display text-heading-s uppercase text-ink">Live campaigns in the account</h2>
        <ul className="mt-3 space-y-1 text-body-s text-ink">
          {data.activeCampaigns.map((c) => (
            <li key={c.id}>
              {config.managedCampaignIds.includes(c.id) ? "★ " : "• "}
              {c.name} {c.dailyBudgetRupees ? `— ${money(c.dailyBudgetRupees)}/day (CBO)` : ""}
              {!config.managedCampaignIds.includes(c.id) && <span className="ml-2 text-caption text-secondary-text">not managed</span>}
            </li>
          ))}
          {data.activeCampaigns.length === 0 && <li className="text-secondary-text">Nothing active.</li>}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-heading-s uppercase text-ink">Managed ad sets — last 7 days</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-body-s">
            <thead>
              <tr className="border-b border-divider text-caption uppercase tracking-[0.05em] text-secondary-text">
                <th className="py-2 pr-4">Ad set</th>
                {dates.map((d) => <th key={d} className="py-2 pr-4">{d.slice(5)}</th>)}
              </tr>
            </thead>
            <tbody>
              {adsets.map(([id, name]) => (
                <tr key={id} className="border-b border-divider">
                  <td className="py-2 pr-4 text-ink">{name.replace(/^PM \| /, "")}</td>
                  {dates.map((d) => {
                    const s = managedSnapshots.find((x) => x.adsetId === id && x.date === d);
                    const bad = s && s.spend >= 100 && (s.roas ?? 0) < config.targetRoas;
                    return <td key={d} className={`py-2 pr-4 ${bad ? "text-paint-orange" : "text-ink"}`}>{s ? `${money(s.spend)} / ${s.purchases} / ${s.roas ?? 0}x` : "—"}</td>;
                  })}
                </tr>
              ))}
              <tr className="font-bold">
                <td className="py-2 pr-4 text-ink">Blended</td>
                {totalsByDate.map((t) => <td key={t.d} className={`py-2 pr-4 ${t.spend >= 100 && (t.roas ?? 0) < config.targetRoas ? "text-paint-orange" : "text-ink"}`}>{money(t.spend)} / {t.purchases} / {t.roas ? t.roas.toFixed(2) : 0}x</td>)}
              </tr>
              {adsets.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-secondary-text">No managed data yet — runs from the first full day after launch.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-caption text-secondary-text">Cells: spend / purchases / ROAS (Meta-attributed, 7-day click, 1-day view). Orange = under target that day.</p>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-heading-s uppercase text-ink">Experiments</h2>
        <div className="mt-3 space-y-2">
          {state.experiments.map((e) => (
            <div key={e.id} className="border border-divider p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-micro font-bold uppercase tracking-[0.05em] ${e.status === "running" ? "text-tan-gold" : e.status === "lost" ? "text-paint-orange" : "text-secondary-text"}`}>{e.status}</span>
                <span className="text-body-s text-ink">{e.name}</span>
                <span className="text-caption text-secondary-text">{e.targetingKind} · {e.creativeKind}</span>
              </div>
              <p className="mt-1 text-caption text-secondary-text">{e.hypothesis}</p>
              {e.resultNote && <p className="mt-1 text-caption text-paint-orange">{e.resultNote}</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-heading-s uppercase text-ink">Audiences</h2>
        <ul className="mt-3 space-y-1 text-body-s text-ink">
          {Object.entries(config.audiences).map(([key, id]) => {
            const s = data.audienceSizes[id];
            return <li key={key}>• {s?.name ?? key} <span className="text-caption text-secondary-text">{s && s.lower >= 0 ? `~${s.lower.toLocaleString("en-IN")}–${s.upper.toLocaleString("en-IN")}` : "populating…"}</span></li>;
          })}
          {Object.keys(config.audiences).length === 0 && <li className="text-secondary-text">None yet — run Bootstrap.</li>}
        </ul>
      </section>

      {state.suggestions.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-heading-s uppercase text-ink">Suggestions</h2>
          <ul className="mt-3 space-y-1 text-body-s text-ink">{state.suggestions.slice(-8).reverse().map((s, i) => <li key={i}>• {s.text}</li>)}</ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="font-display text-heading-s uppercase text-ink">Action log</h2>
        <div className="mt-3 space-y-2">
          {state.actions.slice(-40).reverse().map((a, i) => (
            <div key={i} className="border-t border-divider pt-2">
              <p className="text-caption text-secondary-text">{new Date(a.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} · <span className="font-bold uppercase text-ink">{a.action}</span> · {a.entityName}{a.before || a.after ? ` (${a.before ?? ""} → ${a.after ?? ""})` : ""}</p>
              <p className="text-body-s text-ink">{a.reason}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
