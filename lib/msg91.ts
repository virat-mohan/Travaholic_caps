import { getSetting } from "@/lib/settings";

/**
 * Sends a login OTP via MSG91's Omnichannel Flow API — one call attempts
 * WhatsApp first with automatic SMS fallback if the number isn't on
 * WhatsApp or doesn't respond, all controlled by how MSG91_OTP_TEMPLATE_ID
 * is configured in the MSG91 dashboard (create a Flow there with one
 * variable, VAR1, for the code, and set its channel routing to
 * WhatsApp→SMS). Covers India and international numbers through the same
 * endpoint. Best-effort — returns false rather than throwing so the caller
 * can fall back to another channel.
 */
export async function sendOtpViaMsg91(phone: string, code: string) {
  const [authKey, templateId] = await Promise.all([
    getSetting("MSG91_AUTH_KEY"),
    getSetting("MSG91_OTP_TEMPLATE_ID"),
  ]);
  if (!authKey || !templateId) {
    console.log("MSG91 not configured — skipping MSG91 OTP send");
    return false;
  }

  const digits = phone.replace(/\D/g, "");
  // MSG91 expects the number with country code, no leading +. Assume India
  // (91) for a bare 10-digit number; pass through anything that already
  // includes a country code.
  const mobile = digits.length === 10 ? `91${digits}` : digits;

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
        recipients: [{ mobiles: mobile, VAR1: code }],
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.type === "error") {
      console.error("MSG91 OTP send failed", res.status, data);
      return false;
    }
    return true;
  } catch (err) {
    console.error("MSG91 OTP send failed", err);
    return false;
  }
}
