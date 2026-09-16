"use client";

import { useState } from "react";

const MANUAL_OPTIONS = ["Shipped", "Delivered", "Cancelled"];

/**
 * Manual override for orders shipped outside the normal Shiprocket flow (or
 * whenever the automatic webhook/tracking sweep hasn't caught up yet) —
 * routes through the same applyShipmentStatusUpdate() the real Shiprocket
 * webhook uses (see lib/shiprocket-status.ts), so picking "Delivered" here
 * still fires the review-request nudge exactly once, same transition guard
 * as a real courier update. "Cancelled" deliberately triggers no refund/
 * restock logic — that keyword doesn't match the RTO/NDR/delivered regexes,
 * so it's purely a label; any COD advance already collected is forfeited,
 * per policy, not auto-refunded from here.
 */
export function ShipmentStatusCell({ orderId, currentLabel }: { orderId: string; currentLabel: string }) {
  const [saving, setSaving] = useState(false);
  const [label, setLabel] = useState(currentLabel);

  async function update(next: string) {
    if (!next) return;
    setLabel(next);
    setSaving(true);
    try {
      await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipmentStatus: next }),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-caption text-secondary-text">{label}</span>
      <select
        value=""
        onChange={(e) => update(e.target.value)}
        disabled={saving}
        className="border border-divider bg-surface px-1.5 py-1 font-sans text-micro text-ink"
      >
        <option value="">Mark as...</option>
        {MANUAL_OPTIONS.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
