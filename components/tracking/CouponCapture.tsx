"use client";

import { useEffect } from "react";

export const PENDING_COUPON_KEY = "travaholic_pending_coupon";

/**
 * Captures a `?coupon=CODE` on any landing URL (the Pay With A Post share
 * link, a Story link sticker, a creator's bio link) and holds it for
 * checkout, so someone arriving from a friend's post never has to retype
 * the code — the attribution that decides whether that friend's order
 * ships depends on it being applied.
 */
export function CouponCapture() {
  useEffect(() => {
    try {
      const code = new URLSearchParams(window.location.search).get("coupon");
      if (code && /^[A-Z0-9-]{3,40}$/i.test(code)) {
        localStorage.setItem(PENDING_COUPON_KEY, code.toUpperCase());
      }
    } catch {
      // storage unavailable — the code is still visible in the post itself
    }
  }, []);
  return null;
}
