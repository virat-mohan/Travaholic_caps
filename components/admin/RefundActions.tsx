"use client";

import { useState } from "react";

export function RefundActions({
  orderId,
  total,
  refundedAmount,
  hasRazorpayPayment,
  returnShipmentId,
}: {
  orderId: string;
  total: number;
  refundedAmount: number;
  hasRazorpayPayment: boolean;
  returnShipmentId: string | null;
}) {
  const [refunding, setRefunding] = useState(false);
  const [schedulingReturn, setSchedulingReturn] = useState(false);
  const [refunded, setRefunded] = useState(refundedAmount);
  const [returnScheduled, setReturnScheduled] = useState(!!returnShipmentId);
  const [error, setError] = useState<string | null>(null);

  const maxRefundable = total - refunded;

  async function refund() {
    if (maxRefundable <= 0) return;
    const input = window.prompt(`Refund how much? (max ₹${maxRefundable})`, String(maxRefundable));
    if (input === null) return;
    const amount = Number(input);
    if (!amount || amount <= 0 || amount > maxRefundable) {
      setError(`Enter an amount between ₹1 and ₹${maxRefundable}.`);
      return;
    }
    if (!window.confirm(`Refund ₹${amount} to the customer's original payment method? This can't be undone.`)) {
      return;
    }
    setRefunding(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountRupees: amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Refund failed");
      setRefunded((prev) => prev + data.amountRupees);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refund failed");
    } finally {
      setRefunding(false);
    }
  }

  async function scheduleReturn() {
    if (!window.confirm("Schedule a courier pickup from the customer's address for this return?")) return;
    setSchedulingReturn(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/return-pickup`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not schedule pickup");
      setReturnScheduled(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not schedule pickup");
    } finally {
      setSchedulingReturn(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      {hasRazorpayPayment && maxRefundable > 0 && (
        <button
          onClick={refund}
          disabled={refunding}
          className="border border-ink px-2 py-1 text-micro uppercase tracking-[0.05em] text-ink hover:bg-ink hover:text-cream disabled:opacity-50"
        >
          {refunding ? "..." : `Refund${refunded > 0 ? ` (₹${refunded} done)` : ""}`}
        </button>
      )}
      {returnScheduled ? (
        <span className="text-micro text-secondary-text">Return pickup scheduled</span>
      ) : (
        <button
          onClick={scheduleReturn}
          disabled={schedulingReturn}
          className="text-micro text-secondary-text underline disabled:opacity-50"
        >
          {schedulingReturn ? "..." : "Schedule Return Pickup"}
        </button>
      )}
      {error && <p className="max-w-[160px] text-micro text-paint-orange">{error}</p>}
    </div>
  );
}
