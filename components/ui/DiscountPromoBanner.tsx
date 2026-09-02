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
    <p className={`text-caption uppercase tracking-[0.05em] text-tan-gold ${className}`}>
      {describeDiscountRule(rule)} — Applied Automatically At Checkout
    </p>
  );
}
