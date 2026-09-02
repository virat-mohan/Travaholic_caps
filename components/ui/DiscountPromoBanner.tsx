"use client";

import { useDiscountRule } from "@/lib/useDiscountRule";
import { describeDiscountRule } from "@/lib/discounts";

/**
 * Announces the active bundle discount before a shopper ever reaches the
 * cart — cart/checkout only show the discount once it's actually applied,
 * which means someone with 1-2 caps never learns the offer exists. Renders
 * nothing when no rule is active, so it's safe to drop in anywhere.
 */
export function DiscountPromoBanner({ className = "" }: { className?: string }) {
  const rule = useDiscountRule();
  if (!rule) return null;

  return (
    <div className={`inline-block border border-tan-gold bg-tan-gold/10 px-4 py-2 ${className}`}>
      <p className="font-sans text-body-s font-bold uppercase tracking-[0.05em] text-tan-gold">
        {describeDiscountRule(rule)}
        <span className="font-normal normal-case text-secondary-text"> — applied automatically at checkout</span>
      </p>
    </div>
  );
}
