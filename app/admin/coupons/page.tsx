"use client";

import { Fragment, useEffect, useState } from "react";

type Coupon = {
  id: string;
  code: string;
  discount_type: "flat" | "percent";
  discount_value: number;
  expires_at: string | null;
  usage_limit: number | null;
  times_used: number;
  active: boolean;
  created_at: string;
};

type Redemption = {
  id: string;
  order_id: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  discount_amount: number;
  redeemed_at: string;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"flat" | "percent">("flat");
  const [discountValue, setDiscountValue] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loadingRedemptions, setLoadingRedemptions] = useState(false);

  function loadCoupons() {
    fetch("/api/admin/coupons")
      .then((res) => res.json())
      .then((data) => setCoupons(data.coupons ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(loadCoupons, []);

  async function createCoupon(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          discountType,
          discountValue: Number(discountValue),
          expiresAt: expiresAt || null,
          usageLimit: usageLimit || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create coupon");
      setCode("");
      setDiscountValue("");
      setExpiresAt("");
      setUsageLimit("");
      loadCoupons();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create coupon");
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(coupon: Coupon) {
    setCoupons((prev) => prev.map((c) => (c.id === coupon.id ? { ...c, active: !c.active } : c)));
    await fetch(`/api/admin/coupons/${coupon.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !coupon.active }),
    });
  }

  async function toggleRedemptions(couponId: string) {
    if (expandedId === couponId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(couponId);
    setLoadingRedemptions(true);
    try {
      const res = await fetch(`/api/admin/coupons/${couponId}`);
      const data = await res.json();
      setRedemptions(data.redemptions ?? []);
    } finally {
      setLoadingRedemptions(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1100px] px-6 pt-28 pb-24 md:px-12">
      <h1 className="mt-2 font-display text-heading-l uppercase text-ink">Coupon Codes</h1>
      <p className="mt-2 max-w-lg text-body-s text-secondary-text">
        Time-limited or shareable discount codes, separate from referral codes — entered at
        checkout, with every redemption tracked below.
      </p>

      <form onSubmit={createCoupon} className="mt-8 flex flex-wrap items-end gap-4 border-t border-divider pt-6">
        <div>
          <label className="block text-caption text-secondary-text">Code</label>
          <input
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="LAUNCH20"
            className="mt-1 w-36 border border-divider bg-surface px-2 py-1.5 font-sans text-body-s text-ink"
          />
        </div>
        <div>
          <label className="block text-caption text-secondary-text">Type</label>
          <select
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as "flat" | "percent")}
            className="mt-1 border border-divider bg-surface px-2 py-1.5 font-sans text-body-s text-ink"
          >
            <option value="flat">Flat ₹</option>
            <option value="percent">Percent %</option>
          </select>
        </div>
        <div>
          <label className="block text-caption text-secondary-text">
            Value {discountType === "percent" ? "(%)" : "(₹)"}
          </label>
          <input
            required
            type="number"
            min={1}
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            className="mt-1 w-24 border border-divider bg-surface px-2 py-1.5 font-sans text-body-s text-ink"
          />
        </div>
        <div>
          <label className="block text-caption text-secondary-text">Expires (optional)</label>
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="mt-1 border border-divider bg-surface px-2 py-1.5 font-sans text-body-s text-ink"
          />
        </div>
        <div>
          <label className="block text-caption text-secondary-text">Usage limit (optional)</label>
          <input
            type="number"
            min={1}
            value={usageLimit}
            onChange={(e) => setUsageLimit(e.target.value)}
            placeholder="Unlimited"
            className="mt-1 w-28 border border-divider bg-surface px-2 py-1.5 font-sans text-body-s text-ink"
          />
        </div>
        <button
          type="submit"
          disabled={creating}
          className="border border-ink bg-ink px-5 py-2 font-sans text-caption font-bold uppercase tracking-[0.05em] text-cream hover:bg-cream hover:text-ink disabled:opacity-50"
        >
          {creating ? "Creating..." : "Create Coupon"}
        </button>
      </form>
      {error && <p className="mt-3 text-body-s text-paint-orange">{error}</p>}

      <div className="mt-10 overflow-x-auto">
        <table className="w-full min-w-[800px] text-left">
          <thead>
            <tr className="border-b border-divider text-caption uppercase tracking-[0.05em] text-secondary-text">
              <th className="py-2 pr-4">Code</th>
              <th className="py-2 pr-4">Discount</th>
              <th className="py-2 pr-4">Expires</th>
              <th className="py-2 pr-4">Used</th>
              <th className="py-2 pr-4">Active</th>
              <th className="py-2 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-body-s text-secondary-text">
                  Loading...
                </td>
              </tr>
            ) : coupons.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-body-s text-secondary-text">
                  No coupons yet.
                </td>
              </tr>
            ) : (
              coupons.map((c) => (
                <Fragment key={c.id}>
                  <tr className="border-b border-divider">
                    <td className="py-3 font-sans text-body-s text-ink">{c.code}</td>
                    <td className="py-3 text-caption text-secondary-text">
                      {c.discount_type === "percent" ? `${c.discount_value}%` : `₹${c.discount_value}`}
                    </td>
                    <td className="py-3 text-caption text-secondary-text">
                      {c.expires_at ? formatDate(c.expires_at) : "Never"}
                    </td>
                    <td className="py-3 text-caption text-secondary-text">
                      {c.times_used}
                      {c.usage_limit ? ` / ${c.usage_limit}` : ""}
                    </td>
                    <td className="py-3">
                      <button
                        onClick={() => toggleActive(c)}
                        className={`text-micro uppercase tracking-[0.05em] ${c.active ? "text-tan-gold" : "text-secondary-text"}`}
                      >
                        {c.active ? "Active" : "Disabled"}
                      </button>
                    </td>
                    <td className="py-3">
                      <button
                        onClick={() => toggleRedemptions(c.id)}
                        className="text-micro text-secondary-text underline"
                      >
                        {expandedId === c.id ? "Hide" : "View"} redemptions
                      </button>
                    </td>
                  </tr>
                  {expandedId === c.id && (
                    <tr>
                      <td colSpan={6} className="bg-surface-alt/40 px-4 py-4">
                        {loadingRedemptions ? (
                          <p className="text-caption text-secondary-text">Loading...</p>
                        ) : redemptions.length === 0 ? (
                          <p className="text-caption text-secondary-text">No redemptions yet.</p>
                        ) : (
                          <table className="w-full max-w-lg text-left">
                            <thead>
                              <tr className="text-micro uppercase tracking-[0.05em] text-secondary-text">
                                <th className="pb-1 pr-4">When</th>
                                <th className="pb-1 pr-4">Phone</th>
                                <th className="pb-1 pr-4">Email</th>
                                <th className="pb-1 pr-4">Discount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {redemptions.map((r) => (
                                <tr key={r.id}>
                                  <td className="py-1 pr-4 text-caption text-secondary-text">
                                    {formatDate(r.redeemed_at)}
                                  </td>
                                  <td className="py-1 pr-4 text-caption text-ink">{r.customer_phone ?? "—"}</td>
                                  <td className="py-1 pr-4 text-caption text-ink">{r.customer_email ?? "—"}</td>
                                  <td className="py-1 pr-4 text-caption text-ink">₹{r.discount_amount}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
