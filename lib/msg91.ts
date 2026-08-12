import { getSetting } from "@/lib/settings";

function toMobile(phone: string) {
  const digits = phone.replace(/\D/g, "");
  // MSG91 expects the number with country code, no leading +. Assume India
  // (91) for a bare 10-digit number; pass through anything that already
  // includes a country code.
  return digits.length === 10 ? `91${digits}` : digits;
}

/**
 * Sends a WhatsApp template via MSG91's Omnichannel Flow API — one call
 * attempts WhatsApp first with automatic SMS fallback if the number isn't
 * reachable there, covering India and international numbers through the
 * same endpoint. `variables` map positionally to VAR1, VAR2, ... in the
 * Flow's template. Best-effort — returns { sent: false } rather than
 * throwing so the caller can fall back to another provider.
 */
export async function sendMsg91Flow(templateId: string | null, phone: string, variables: string[]) {
  const authKey = await getSetting("MSG91_AUTH_KEY");
  if (!authKey || !templateId) {
    return { sent: false as const };
  }

  const varFields = Object.fromEntries(variables.map((v, i) => [`VAR${i + 1}`, v]));

  try {
    const res = await fetch("https://control.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: {
        authkey: authKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        template_id: templateId,
        short_url: "0",
        recipients: [{ mobiles: toMobile(phone), ...varFields }],
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.type === "error") {
      console.error("MSG91 send failed", res.status, data);
      return { sent: false as const };
    }
    // Exact response shape for message-id tracking hasn't been verified
    // against a live key yet — check real payloads once MSG91 is active and
    // adjust this lookup if delivery/read tracking doesn't populate.
    const messageId = data?.request_id ?? data?.data?.[0]?.message_id ?? null;
    return { sent: true as const, messageId: messageId ? String(messageId) : undefined };
  } catch (err) {
    console.error("MSG91 send failed", err);
    return { sent: false as const };
  }
}

/** Login OTP — one variable (the code). */
export async function sendOtpViaMsg91(phone: string, code: string) {
  const templateId = await getSetting("MSG91_OTP_TEMPLATE_ID");
  const result = await sendMsg91Flow(templateId, phone, [code]);
  return result.sent;
}
