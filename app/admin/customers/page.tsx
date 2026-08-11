"use client";

import { useEffect, useState } from "react";

type Customer = {
  phone: string;
  name: string;
  email: string;
  orderCount: number;
  capsBought: number;
  totalSpent: number;
  lastOrderAt: string;
  miles: number;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [milesPerCap, setMilesPerCap] = useState(100);
  const [redemptionThreshold, setRedemptionThreshold] = useState(500);
  const [redemptionValueRupees, setRedemptionValueRupees] = useState(100);
  const [loading, setLoading] = useState(true);

  function load() {
    fetch("/api/admin/customers")
      .then((res) => res.json())
      .then((data) => setCustomers(data.customers ?? []))
      .finally(() => setLoading(false));

    fetch("/api/admin/loyalty-config")
      .then((res) => res.json())
      .then((data) => {
        setMilesPerCap(data.milesPerCap ?? 100);
        setRedemptionThreshold(data.redemptionThreshold ?? 500);
        setRedemptionValueRupees(data.redemptionValueRupees ?? 100);
      });
  }

  useEffect(load, []);

  async function saveLoyaltyConfig(patch: Record<string, number>) {
    await fetch("/api/admin/loyalty-config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    load();
  }

  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 pt-28 pb-24 md:px-12">
      <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">
        Internal — not linked in navigation
      </p>
      <h1 className="mt-2 font-display text-heading-l uppercase text-ink">Customers</h1>
      <p className="mt-2 max-w-xl text-body-s text-secondary-text">
        Grouped by phone number. Miles shown here are earned by anyone who&apos;s ever bought
        something — only customers who&apos;ve logged in via /account can actually redeem them at
        checkout, since redemption needs an account to hold the ledger.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-divider pt-6">
        <div className="flex items-center gap-3">
          <label className="text-caption text-secondary-text">Miles earned per cap bought</label>
          <input
            type="number"
            value={milesPerCap}
            onChange={(e) => setMilesPerCap(Number(e.target.value))}
            onBlur={() => saveLoyaltyConfig({ milesPerCap })}
            className="w-24 border border-divider bg-surface px-2 py-1 text-body-s text-ink"
          />
        </div>
        <div className="flex items-center gap-3">
          <label className="text-caption text-secondary-text">Miles per redemption</label>
          <input
            type="number"
            value={redemptionThreshold}
            onChange={(e) => setRedemptionThreshold(Number(e.target.value))}
            onBlur={() => saveLoyaltyConfig({ redemptionThreshold })}
            className="w-24 border border-divider bg-surface px-2 py-1 text-body-s text-ink"
          />
        </div>
        <div className="flex items-center gap-3">
          <label className="text-caption text-secondary-text">Worth ₹</label>
          <input
            type="number"
            value={redemptionValueRupees}
            onChange={(e) => setRedemptionValueRupees(Number(e.target.value))}
            onBlur={() => saveLoyaltyConfig({ redemptionValueRupees })}
            className="w-24 border border-divider bg-surface px-2 py-1 text-body-s text-ink"
          />
        </div>
        <p className="text-caption text-secondary-text">
          e.g. every {redemptionThreshold.toLocaleString("en-IN")} Miles = ₹
          {redemptionValueRupees.toLocaleString("en-IN")} off at checkout.
        </p>
      </div>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[900px] text-left">
          <thead>
            <tr className="border-b border-divider text-caption uppercase tracking-[0.05em] text-secondary-text">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Phone</th>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Orders</th>
              <th className="py-2 pr-4">Caps Bought</th>
              <th className="py-2 pr-4">Total Spent</th>
              <th className="py-2 pr-4">Last Order</th>
              <th className="py-2 pr-4">Miles</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-body-s text-secondary-text">
                  Loading...
                </td>
              </tr>
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-body-s text-secondary-text">
                  No orders yet.
                </td>
              </tr>
            ) : (
              customers.map((c) => (
                <tr key={c.phone} className="border-b border-divider">
                  <td className="py-3 font-sans text-body-s text-ink">{c.name}</td>
                  <td className="py-3 text-caption text-secondary-text">{c.phone}</td>
                  <td className="py-3 text-caption text-secondary-text">{c.email}</td>
                  <td className="py-3 text-body-s text-ink">{c.orderCount}</td>
                  <td className="py-3 text-body-s text-ink">{c.capsBought}</td>
                  <td className="py-3 text-body-s text-ink">₹{c.totalSpent.toLocaleString("en-IN")}</td>
                  <td className="py-3 text-caption text-secondary-text">{formatDate(c.lastOrderAt)}</td>
                  <td className="py-3 font-display text-body-s text-tan-gold">
                    {c.miles.toLocaleString("en-IN")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
