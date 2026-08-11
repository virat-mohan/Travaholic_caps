"use client";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

const SESSION_KEY_STORAGE = "travaholic-session-key";

/** A stable per-browser id used to correlate cart_sessions, tracking_events and orders. */
export function getSessionKey() {
  if (typeof window === "undefined") return "";
  let key = localStorage.getItem(SESSION_KEY_STORAGE);
  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY_STORAGE, key);
  }
  return key;
}

type TrackParams = { chapterSlug?: string; value?: number; currency?: string };

/**
 * Fires an event to both the Meta pixel (if loaded) and our own first-party
 * log — the first-party log is the one /admin/reports actually trusts, since
 * it isn't affected by ad blockers or cookie consent state.
 */
export function trackEvent(
  eventName: "PageView" | "ViewContent" | "AddToCart" | "InitiateCheckout" | "Purchase",
  params: TrackParams = {}
) {
  if (typeof window === "undefined") return;

  if (window.fbq) {
    if (params.value != null) {
      window.fbq("track", eventName, { value: params.value, currency: params.currency ?? "INR" });
    } else {
      window.fbq("track", eventName);
    }
  }

  fetch("/api/tracking/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventName, sessionKey: getSessionKey(), ...params }),
  }).catch(() => {});
}
