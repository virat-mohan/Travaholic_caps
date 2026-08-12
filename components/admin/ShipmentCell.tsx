"use client";

import { useState } from "react";

export function ShipmentCell({
  orderId,
  shipmentId,
  awbCode,
  courierName,
}: {
  orderId: string;
  shipmentId: string | null;
  awbCode: string | null;
  courierName: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState({ shipmentId, awbCode, courierName });

  async function ship() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/ship`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not ship");
      setState((s) => ({ ...s, shipmentId: data.shipmentId }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not ship");
    } finally {
      setBusy(false);
    }
  }

  async function track() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/track`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not check tracking");
      setState((s) => ({ ...s, awbCode: data.awbCode ?? s.awbCode, courierName: data.courierName ?? s.courierName }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check tracking");
    } finally {
      setBusy(false);
    }
  }

  if (!state.shipmentId) {
    return (
      <div>
        <button
          onClick={ship}
          disabled={busy}
          className="border border-ink px-2 py-1 text-micro uppercase tracking-[0.05em] text-ink hover:bg-ink hover:text-cream disabled:opacity-50"
        >
          {busy ? "..." : "Ship"}
        </button>
        {error && <p className="mt-1 max-w-[160px] text-micro text-paint-orange">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <p className="text-caption text-secondary-text">
        {state.courierName ?? "Awaiting courier"}
        {state.awbCode && <> · {state.awbCode}</>}
      </p>
      <button
        onClick={track}
        disabled={busy}
        className="mt-1 text-micro text-secondary-text underline disabled:opacity-50"
      >
        {busy ? "Checking..." : "Refresh Tracking"}
      </button>
      {error && <p className="mt-1 max-w-[160px] text-micro text-paint-orange">{error}</p>}
    </div>
  );
}
