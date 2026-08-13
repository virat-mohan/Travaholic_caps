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
export async function sendMsg91Flow(flowSlug: string | null, phone: string, variables: string[]) {
  const authKey = await getSetting("MSG91_AUTH_KEY");
  if (!authKey || !flowSlug) {
    return { sent: false as const };
  }

  const varFields = Object.fromEntries(variables.map((v, i) => [`VAR${i + 1}`, v]));

  try {
    const res = await fetch(`https://control.msg91.com/api/v5/oneapi/api/flow/${flowSlug}/run`, {
      method: "POST",
      headers: {
        authkey: authKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          sendTo: [
            {
              to: [{ mobiles: toMobile(phone), variables: varFields }],
              variables: [],
            },
          ],
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
