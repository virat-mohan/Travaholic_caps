// The one WhatsApp template the admin inbox can send to a thread that is past
// Meta's 24-hour window. Pure helpers only, so they can be unit-tested.

export const SUPPORT_TEMPLATE = {
  settingKey: "MSG91_SUPPORT_FOLLOWUP_TEMPLATE_ID",
  name: "support_followup",
  category: "UTILITY",
  // One variable (first name). A fixed reply line instead of a free {{2}},
  // because Meta tends to reject templates that are mostly a free variable.
  body:
    "Hi {{1}}, this is Travaholic replying to your message. We have an update for you on your query. Reply here and we'll take it from there.",
  example: ["Riya"],
} as const;

/** First name from the conversation/customer record, or "there". */
export function firstNameOrThere(...names: Array<string | null | undefined>): string {
  for (const n of names) {
    const first = String(n ?? "").trim().split(/\s+/)[0]?.replace(/[^\p{L}\p{M}'-]/gu, "");
    if (first && first.length <= 30) return first.charAt(0).toUpperCase() + first.slice(1);
  }
  return "there";
}

/** The exact text the customer sees, for the inbox log. */
export function renderSupportBody(firstName: string): string {
  return SUPPORT_TEMPLATE.body.replace("{{1}}", firstName);
}

/** True only for a Meta-approved row that kept the UTILITY category. */
export function isTemplateUsable(row: { status?: string | null; category?: string | null } | null | undefined): boolean {
  if (!row || String(row.status ?? "").toLowerCase() !== "approved") return false;
  return !row.category || String(row.category).toUpperCase() === "UTILITY";
}
