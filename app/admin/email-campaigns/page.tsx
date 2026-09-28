"use client";

import { useEffect, useState } from "react";

type Stats = {
  audience: number;
  sent: number;
  failed: number;
  unsubscribed: number;
  brevo: { delivered: number; uniqueOpens: number; uniqueClicks: number; hardBounces: number; softBounces: number } | null;
  orders: { id: string; created_at: string; customer_name: string; delivery_city: string | null; total: number; payment_status: string }[];
  paidOrders: number;
  revenue: number;
  discountGiven: number;
};

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : "—");

export default function EmailCampaignsPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/admin/email-campaigns")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  const tiles = stats
    ? [
        { label: "Sent", value: `${stats.sent} / ${stats.audience}`, sub: `${stats.failed} failed · ${stats.unsubscribed} unsubscribed` },
        { label: "Delivered", value: String(stats.brevo?.delivered ?? "—"), sub: `${(stats.brevo?.hardBounces ?? 0) + (stats.brevo?.softBounces ?? 0)} bounced` },
        { label: "Opened", value: String(stats.brevo?.uniqueOpens ?? "—"), sub: pct(stats.brevo?.uniqueOpens ?? 0, stats.brevo?.delivered ?? 0) + " open rate" },
        { label: "Clicked", value: String(stats.brevo?.uniqueClicks ?? "—"), sub: pct(stats.brevo?.uniqueClicks ?? 0, stats.brevo?.delivered ?? 0) + " click rate" },
        { label: "Paid orders", value: String(stats.paidOrders), sub: pct(stats.paidOrders, stats.brevo?.uniqueClicks ?? 0) + " of clickers" },
        { label: "Revenue", value: inr(stats.revenue), sub: `${inr(stats.discountGiven)} discount given` },
      ]
    : [];

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">Marketing</p>
      <h1 className="mt-1 font-display text-heading-l uppercase text-ink">Email Campaigns</h1>

      <section className="mt-8 border border-divider bg-surface p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-heading-s uppercase text-ink">Welcome Back · 15% off (WELCOMEBACK15)</h2>
          <p className="text-body-s text-secondary-text">Past customers · sent daily in batches until everyone has it · 24h offer per batch</p>
        </div>

        {!stats ? (
          <p className="mt-6 text-body-s text-secondary-text">Loading…</p>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
              {tiles.map((t) => (
                <div key={t.label} className="border border-divider p-4">
                  <p className="text-caption uppercase tracking-[0.12em] text-secondary-text">{t.label}</p>
                  <p className="mt-1 font-display text-heading-m text-ink">{t.value}</p>
                  <p className="text-caption text-secondary-text">{t.sub}</p>
                </div>
              ))}
            </div>

            <h3 className="mt-8 text-caption uppercase tracking-[0.12em] text-secondary-text">Orders using WELCOMEBACK15</h3>
            {stats.orders.length === 0 ? (
              <p className="mt-2 text-body-s text-secondary-text">No orders yet.</p>
            ) : (
              <table className="mt-2 w-full text-body-s">
                <tbody>
                  {stats.orders.map((o) => (
                    <tr key={o.id} className="border-t border-divider">
                      <td className="py-2">{new Date(o.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</td>
                      <td className="py-2">{o.customer_name}</td>
                      <td className="py-2">{o.delivery_city ?? ""}</td>
                      <td className="py-2 text-right">{inr(o.total)}</td>
                      <td className="py-2 text-right uppercase">{o.payment_status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </section>
    </main>
  );
}
