// Meta allows a free-form WhatsApp reply only within 24 hours of the
// customer's last message; after that only an approved template can go out.
// Same rule as the viratmohan.com inbox (src/lib/whatsapp-inbox.ts).
export const REPLY_WINDOW_MS = 24 * 60 * 60 * 1000;

export function canReplyFreeForm(lastInboundAt: string | null | undefined, now = new Date()): boolean {
  if (!lastInboundAt) return false;
  const t = new Date(lastInboundAt).getTime();
  return Number.isFinite(t) && now.getTime() - t < REPLY_WINDOW_MS;
}

/** Latest inbound timestamp per conversation, from rows sorted any way. */
export function lastInboundByConversation(rows: Array<{ conversation_id: string; created_at: string }>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) {
    if (!out[r.conversation_id] || r.created_at > out[r.conversation_id]) out[r.conversation_id] = r.created_at;
  }
  return out;
}

/** Maps an MSG91 / Cloud-API status word to the inbox status, or null if unknown. */
export function normaliseStatus(raw: unknown, statusCode?: unknown): "sent" | "delivered" | "read" | "failed" | null {
  const s = String(raw ?? "").toLowerCase();
  if (s.includes("read") || s.includes("seen")) return "read";
  if (s.includes("delivered")) return "delivered";
  if (s.includes("fail") || s.includes("undelivered") || s.includes("invalid") || (statusCode && Number(statusCode) >= 400)) return "failed";
  if (s.includes("sent")) return "sent";
  return null;
}
