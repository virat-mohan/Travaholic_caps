import { getSetting, setSetting } from "@/lib/settings";
import { SUPPORT_TEMPLATE, isTemplateUsable } from "@/lib/support-template";
import { checkVoice, hasBlock, describeBlocks } from "@/lib/brand-voice";

type TemplateRow = { name?: string; category?: string; status?: string; languages?: { status?: string }[] };

/**
 * Submits only support_followup to MSG91 for Meta approval. Touches no other
 * template (there is deliberately no "submit all" here).
 */
export async function submitSupportFollowupTemplate(): Promise<{ ok: boolean; detail: string }> {
  // Brand book lock: template text is checked before it goes to Meta for approval.
  const voice = checkVoice(SUPPORT_TEMPLATE.body, "whatsapp");
  if (hasBlock(voice)) return { ok: false, detail: `Brand voice: ${describeBlocks(voice)}` };
  const authKey = await getSetting("MSG91_AUTH_KEY");
  const integratedNumber = await getSetting("MSG91_WHATSAPP_INTEGRATED_NUMBER");
  if (!authKey || !integratedNumber) return { ok: false, detail: "MSG91 Auth Key or Integrated Number missing in Settings." };
  const res = await fetch("https://control.msg91.com/api/v5/whatsapp/client-panel-template/", {
    method: "POST",
    headers: { authkey: authKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      integrated_number: integratedNumber,
      template_name: SUPPORT_TEMPLATE.name,
      language: "en",
      category: SUPPORT_TEMPLATE.category,
      button_url: "false",
      components: [{ type: "BODY", text: SUPPORT_TEMPLATE.body, example: { body_text: [SUPPORT_TEMPLATE.example] } }],
    }),
  });
  const data = await res.json().catch(() => null);
  const message = typeof data?.errors === "string" ? data.errors : JSON.stringify(data?.errors ?? data?.message ?? data ?? res.status);
  const alreadyExists = /already exist|already English content/i.test(message);
  const ok = (res.ok && !data?.hasError) || alreadyExists;
  return { ok, detail: ok ? (alreadyExists ? "Already exists" : "Submitted for approval") : message };
}

/** Live status of support_followup in MSG91; saves the setting once approved. */
export async function supportFollowupStatus(): Promise<{ status: string; usable: boolean }> {
  const authKey = await getSetting("MSG91_AUTH_KEY");
  const integratedNumber = await getSetting("MSG91_WHATSAPP_INTEGRATED_NUMBER");
  if (!authKey || !integratedNumber) return { status: "not configured", usable: false };
  try {
    const res = await fetch(`https://control.msg91.com/api/v5/whatsapp/get-template-client/${integratedNumber}`, {
      headers: { authkey: authKey },
    });
    const data = await res.json().catch(() => null);
    const rows: TemplateRow[] = Array.isArray(data?.data) ? data.data : [];
    const row = rows.find((r) => r.name === SUPPORT_TEMPLATE.name);
    if (!row) return { status: "not submitted", usable: false };
    const status = row.languages?.[0]?.status ?? row.status ?? "unknown";
    const usable = isTemplateUsable({ status, category: row.category });
    if (usable && (await getSetting(SUPPORT_TEMPLATE.settingKey)) !== SUPPORT_TEMPLATE.name) {
      await setSetting(SUPPORT_TEMPLATE.settingKey, SUPPORT_TEMPLATE.name);
    }
    return { status: usable ? "approved" : String(status).toLowerCase(), usable };
  } catch {
    return { status: "unknown", usable: false };
  }
}
