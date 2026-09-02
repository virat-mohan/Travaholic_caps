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
    <div
      className={`inline-flex max-w-full items-center justify-center whitespace-nowrap rounded-full border border-tan-gold bg-tan-gold px-5 py-2 shadow-[0_4px_14px_rgba(0,0,0,0.15)] ${className}`}
    >
      <p className="overflow-hidden text-ellipsis font-sans text-micro font-bold uppercase tracking-[0.06em] text-ink md:text-caption">
        {describeDiscountRule(rule)}
        <span className="ml-1.5 font-normal normal-case text-ink/70"> — applied automatically at checkout</span>
      </p>
    </div>
  );
}
