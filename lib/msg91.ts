import { getSetting } from "@/lib/settings";

function toMobile(phone: string) {
  const digits = phone.replace(/\D/g, "");
  // MSG91 expects the number with country code, no leading +. Assume India
  // (91) for a bare 10-digit number; pass through anything that already
  // includes a country code.
  return digits.length === 10 ? `91${digits}` : digits;
}

/**
 * Sends a message via one of MSG91's OneAPI Flows. `flowSlug` is the Flow's
 * URL slug (e.g. "login-otp"), found via the `</>` "View Code" button on the
 * Flow builder canvas — NOT a numeric/UUID template ID, MSG91's newer OneAPI
 * flows key off the slug directly in the request URL. `variables` map
 * positionally to VAR1, VAR2, ... in the Flow's template. Best-effort —
 * returns { sent: false } rather than throwing so the caller can decide what
 * to do next.
 */
export async function sendMsg91Flow(
  flowSlug: string | null,
  phone: string,
  variables: string[],
  mediaUrl?: string
) {
  // Hard off-switch for launch — going live on email only, WhatsApp/SMS is
  // being set up separately. This is the one choke point every WhatsApp
  // send in the app routes through (OTP, order confirmation, NDR/RTO
  // nudges, referral invites, abandoned cart, win-back), so flipping this
  // one setting is enough to silence all of them without touching each
  // call site. Set WHATSAPP_SMS_ENABLED to "true" in /admin/settings once
  // MSG91 is actually configured and ready to go live.
  const enabled = await getSetting("WHATSAPP_SMS_ENABLED");
  if (enabled !== "true") {
    return { sent: false as const };
  }

  const authKey = await getSetting("MSG91_AUTH_KEY");
  if (!authKey || !flowSlug) {
    return { sent: false as const };
  }

  const varFields = Object.fromEntries(variables.map((v, i) => [`VAR${i + 1}`, v]));
  // Media-header field placement isn't confirmed against a real
  // media-attached template yet (only verified the plain-text OTP shape) —
  // this is the common BSP pattern (a `media` object alongside `mobiles`),
  // check a real send once the Order Confirmation Flow has an image header
  // configured and adjust if MSG91 rejects or ignores it.
  const to: Record<string, unknown> = { mobiles: toMobile(phone), variables: varFields };
  if (mediaUrl) to.media = { url: mediaUrl };

  try {
    const res = await fetch(`https://control.msg91.com/api/v5/oneapi/api/flow/${flowSlug}/run`, {
      method: "POST",
      headers: {
        authkey: authKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          sendTo: [{ to: [to], variables: [] }],
        },
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.type === "error") {
      console.error("MSG91 send failed", res.status, data);
      return { sent: false as const };
    }
    // Exact response shape for message-id tracking hasn't been verified
    // against a live success response yet — check the real payload once a
    // send actually succeeds and adjust this lookup if delivery/read
    // tracking doesn't populate in /admin/reports.
    const messageId = data?.request_id ?? data?.data?.request_id ?? data?.data?.[0]?.message_id ?? null;
    return { sent: true as const, messageId: messageId ? String(messageId) : undefined };
  } catch (err) {
    console.error("MSG91 send failed", err);
    return { sent: false as const };
  }
}

/** Login OTP — one variable (the code). */
export async function sendOtpViaMsg91(phone: string, code: string) {
  const flowSlug = await getSetting("MSG91_OTP_TEMPLATE_ID");
  const result = await sendMsg91Flow(flowSlug, phone, [code]);
  return result.sent;
}
