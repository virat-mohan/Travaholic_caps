"use client";

import { useEffect, useState } from "react";
import { downloadCsv } from "@/lib/csv-export";

type Report = {
  id: string;
  week_start: string;
  week_end: string;
  ad_spend: number;
  clicks: number;
  impressions: number;
  page_views: number;
  add_to_carts: number;
  checkouts_started: number;
  orders_count: number;
  revenue: number;
  abandoned_carts: number;
  roas: number | null;
};

type WhatsAppStats = { sent: number; delivered: number; read: number; converted: number };

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [whatsapp, setWhatsapp] = useState<Record<string, WhatsAppStats>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [sweepResult, setSweepResult] = useState<string | null>(null);
  const [winbackRunning, setWinbackRunning] = useState(false);
  const [winbackResult, setWinbackResult] = useState<string | null>(null);
  const [salesSignalRunning, setSalesSignalRunning] = useState(false);
  const [salesSignalResult, setSalesSignalResult] = useState<string | null>(null);
  const [digestRunning, setDigestRunning] = useState(false);
  const [digestResult, setDigestResult] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/reports")
      .then((res) => res.json())
      .then((data) => {
        setReports(data.reports ?? []);
        setWhatsapp(data.whatsapp ?? {});
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function generate() {
    setGenerating(true);
    try {
      await fetch("/api/admin/reports", { method: "POST" });
      load();
    } finally {
      setGenerating(false);
    }
  }

  async function runSweep() {
    setSweeping(true);
    setSweepResult(null);
    try {
      const res = await fetch("/api/cron/abandon-sweep");
      const data = await res.json();
      setSweepResult(
        res.ok
          ? `${data.abandoned} cart(s) marked abandoned, ${data.retargeted} WhatsApp nudge(s) sent.`
          : "Sweep failed."
      );
    } finally {
      setSweeping(false);
    }
  }

  async function runWinback() {
    setWinbackRunning(true);
    setWinbackResult(null);
    try {
      const res = await fetch("/api/cron/winback");
      const data = await res.json();
      setWinbackResult(
        res.ok
          ? `${data.sent} lapsed customer(s) nudged (of ${data.lapsedCustomersChecked} checked).`
          : "Sweep failed."
      );
    } finally {
      setWinbackRunning(false);
    }
  }

  async function runSalesSignalSweep() {
    setSalesSignalRunning(true);
    setSalesSignalResult(null);
    try {
      const res = await fetch("/api/cron/sales-signal-briefs");
      const data = await res.json();
      setSalesSignalResult(
        res.ok
          ? `${data.drafted?.length ?? 0} brief(s) drafted, ${data.skipped?.length ?? 0} skipped — review in Ad Brief Generator.`
          : "Sweep failed."
      );
    } finally {
      setSalesSignalRunning(false);
    }
  }

  async function runOpsDigest() {
    setDigestRunning(true);
    setDigestResult(null);
    try {
      const res = await fetch("/api/cron/ops-digest");
      const data = await res.json();
      setDigestResult(
        res.ok
          ? `Sent — ${data.newOrders} order(s), ₹${data.revenue?.toLocaleString("en-IN")}, ${data.lowStockCount} low-stock item(s).`
          : "Digest failed."
      );
    } finally {
      setDigestRunning(false);
    }
  }

  function exportCsv() {
    downloadCsv("travaholic-growth-reports.csv", [
      [
        "Week Start",
        "Week End",
        "Ad Spend",
        "Clicks",
        "Impressions",
        "Page Views",
        "Add To Carts",
        "Checkouts Started",
        "Orders",
        "Revenue",
        "Abandoned Carts",
        "ROAS",
      ],
      ...reports.map((r) => [
        r.week_start,
        r.week_end,
        r.ad_spend,
        r.clicks,
        r.impressions,
        r.page_views,
        r.add_to_carts,
        r.checkouts_started,
        r.orders_count,
        r.revenue,
        r.abandoned_carts,
        r.roas ?? "",
      ]),
    ]);
  }

  return (
    <main className="mx-auto w-full max-w-[1100px] px-6 pt-28 pb-24 md:px-12">
      <div className="flex items-center justify-between">
        <h1 className="mt-2 font-display text-heading-l uppercase text-ink">Growth Reports</h1>
        {reports.length > 0 && (
          <button
            onClick={exportCsv}
            className="border border-divider px-4 py-2 text-caption uppercase tracking-[0.05em] text-ink hover:border-ink"
          >
            Export CSV
          </button>
        )}
      </div>
      <p className="mt-2 max-w-lg text-body-s text-secondary-text">
        Funnel and ROAS, weekly. Page views/add-to-cart/checkout counts are first-party (not
        dependent on Meta&apos;s pixel); ad spend and clicks come from Meta once configured.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          onClick={generate}
          disabled={generating}
          className="border border-ink px-5 py-2 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink transition-colors duration-300 hover:bg-ink hover:text-cream disabled:opacity-50"
        >
          {generating ? "Generating..." : "Generate This Week's Report"}
        </button>
        <button
          onClick={runSweep}
          disabled={sweeping}
          className="border border-divider px-5 py-2 font-sans text-caption uppercase tracking-[0.05em] text-ink hover:border-ink disabled:opacity-50"
        >
          {sweeping ? "Running..." : "Run Abandoned-Cart Sweep Now"}
        </button>
        {sweepResult && <p className="text-caption text-secondary-text">{sweepResult}</p>}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button
          onClick={runWinback}
          disabled={winbackRunning}
          className="border border-divider px-5 py-2 font-sans text-caption uppercase tracking-[0.05em] text-ink hover:border-ink disabled:opacity-50"
        >
          {winbackRunning ? "Running..." : "Run Win-Back Sweep Now"}
        </button>
        {winbackResult && <p className="text-caption text-secondary-text">{winbackResult}</p>}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button
          onClick={runSalesSignalSweep}
          disabled={salesSignalRunning}
          className="border border-divider px-5 py-2 font-sans text-caption uppercase tracking-[0.05em] text-ink hover:border-ink disabled:opacity-50"
        >
          {salesSignalRunning ? "Running..." : "Run Sales-Signal Brief Sweep Now"}
        </button>
        {salesSignalResult && <p className="text-caption text-secondary-text">{salesSignalResult}</p>}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button
          onClick={runOpsDigest}
          disabled={digestRunning}
          className="border border-divider px-5 py-2 font-sans text-caption uppercase tracking-[0.05em] text-ink hover:border-ink disabled:opacity-50"
        >
          {digestRunning ? "Sending..." : "Send Ops Digest Now"}
        </button>
        {digestResult && <p className="text-caption text-secondary-text">{digestResult}</p>}
      </div>

      <div className="mt-10 overflow-x-auto">
        <table className="w-full min-w-[900px] text-left">
          <thead>
            <tr className="border-b border-divider text-caption uppercase tracking-[0.05em] text-secondary-text">
              <th className="py-2 pr-4">Week</th>
              <th className="py-2 pr-4">Spend</th>
              <th className="py-2 pr-4">Clicks</th>
              <th className="py-2 pr-4">Views</th>
              <th className="py-2 pr-4">Add To Cart</th>
              <th className="py-2 pr-4">Checkouts</th>
              <th className="py-2 pr-4">Orders</th>
              <th className="py-2 pr-4">Revenue</th>
              <th className="py-2 pr-4">Abandoned</th>
              <th className="py-2 pr-4">ROAS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="py-8 text-center text-body-s text-secondary-text">
                  Loading...
                </td>
              </tr>
            ) : reports.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-8 text-center text-body-s text-secondary-text">
                  No reports yet — generate this week&apos;s.
                </td>
              </tr>
            ) : (
              reports.map((r) => (
                <tr key={r.id} className="border-b border-divider">
                  <td className="py-3 text-caption text-secondary-text">
                    {r.week_start} → {r.week_end}
                  </td>
                  <td className="py-3 text-body-s text-ink">₹{r.ad_spend.toLocaleString("en-IN")}</td>
                  <td className="py-3 text-body-s text-ink">{r.clicks}</td>
                  <td className="py-3 text-body-s text-ink">{r.page_views}</td>
                  <td className="py-3 text-body-s text-ink">{r.add_to_carts}</td>
                  <td className="py-3 text-body-s text-ink">{r.checkouts_started}</td>
                  <td className="py-3 text-body-s text-ink">{r.orders_count}</td>
                  <td className="py-3 text-body-s text-ink">₹{r.revenue.toLocaleString("en-IN")}</td>
                  <td className="py-3 text-body-s text-paint-orange">{r.abandoned_carts}</td>
                  <td className="py-3 font-display text-body-s text-tan-gold">
                    {r.roas != null ? `${r.roas}x` : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-16">
        <h2 className="font-display text-heading-s uppercase text-ink">
          WhatsApp Performance (All Time)
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[600px] text-left">
            <thead>
              <tr className="border-b border-divider text-caption uppercase tracking-[0.05em] text-secondary-text">
                <th className="py-2 pr-4">Template</th>
                <th className="py-2 pr-4">Sent</th>
                <th className="py-2 pr-4">Delivered</th>
                <th className="py-2 pr-4">Read (Opened)</th>
                <th className="py-2 pr-4">Converted</th>
                <th className="py-2 pr-4">Conversion Rate</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(whatsapp).length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-body-s text-secondary-text">
                    No WhatsApp sends yet.
                  </td>
                </tr>
              ) : (
                Object.entries(whatsapp).map(([template, stats]) => (
                  <tr key={template} className="border-b border-divider">
                    <td className="py-3 text-body-s text-ink">{template}</td>
                    <td className="py-3 text-body-s text-ink">{stats.sent}</td>
                    <td className="py-3 text-body-s text-ink">{stats.delivered}</td>
                    <td className="py-3 text-body-s text-ink">{stats.read}</td>
                    <td className="py-3 text-body-s text-ink">{stats.converted}</td>
                    <td className="py-3 font-display text-body-s text-tan-gold">
                      {stats.sent > 0 ? `${((stats.converted / stats.sent) * 100).toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
