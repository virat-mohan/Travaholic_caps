/** Pure helpers for in-app browsers and UPI deep links. No imports (testable in Node). */

export function detectInAppBrowser(ua: string): "instagram" | "facebook" | null {
  if (/Instagram/i.test(ua)) return "instagram";
  if (/FBAN|FBAV|FB_IAB|FBIOS|FB4A/i.test(ua)) return "facebook";
  return null;
}

/** Android webviews can hand off to Chrome with an intent:// URL; iOS cannot, so we show a hint instead. */
export function openInBrowserUrl(httpsUrl: string, ua: string): string | null {
  if (!/Android/i.test(ua)) return null;
  const u = new URL(httpsUrl);
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(httpsUrl)};end`;
}

/** /cart?items=slug:qty,... — the cart deep-link format lib/cart-deep-link.ts parses, so the cart survives the browser switch. */
export function cartDeepLinkPath(items: { slug: string; quantity: number }[]) {
  return `/cart?items=${items.map((i) => `${encodeURIComponent(i.slug)}:${i.quantity}`).join(",")}&utm_source=inapp_handoff`;
}

/**
 * UPI intent links built server-side from the trusted total. `ref` is the
 * Razorpay order id so a manual payment can be matched. Returns null when
 * no business UPI ID is configured (never falls back to a personal VPA).
 */
export function buildUpiIntents(opts: { vpa: string | null; payeeName: string; amountRupees: number; ref: string }) {
  if (!opts.vpa || !/^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/.test(opts.vpa)) return null;
  if (!(opts.amountRupees > 0)) return null;
  const q = new URLSearchParams({
    pa: opts.vpa,
    pn: opts.payeeName,
    am: opts.amountRupees.toFixed(2),
    cu: "INR",
    tr: opts.ref,
    tn: `Travaholic ${opts.ref}`.slice(0, 50),
  }).toString();
  return {
    any: `upi://pay?${q}`,
    gpay: `tez://upi/pay?${q}`,
    phonepe: `phonepe://pay?${q}`,
    paytm: `paytmmp://pay?${q}`,
  };
}

export function whatsappHelpUrl(number: string, lines: string[]) {
  return `https://wa.me/${number}?text=${encodeURIComponent(lines.join("\n"))}`;
}
