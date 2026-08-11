import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

/**
 * Interakt's delivery/read status webhook. Exact payload field names vary by
 * account/API version, so this reads defensively across the field names
 * Interakt has used (message id under `id`/`messageId`/`message_id`, status
 * under `event`/`status`) rather than assuming one shape — verify against
 * real webhook payloads once Interakt is connected and adjust the field
 * lookups below if they don't match.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: true });

  const messageId = body.id ?? body.messageId ?? body.message_id ?? body.data?.id;
  const rawStatus = (body.event ?? body.status ?? body.data?.status ?? "").toString().toLowerCase();

  if (!messageId || !rawStatus) return NextResponse.json({ ok: true });

  const patch: Record<string, string> = {};
  if (rawStatus.includes("read")) {
    patch.status = "read";
    patch.read_at = new Date().toISOString();
  } else if (rawStatus.includes("delivered")) {
    patch.status = "delivered";
    patch.delivered_at = new Date().toISOString();
  } else if (rawStatus.includes("fail")) {
    patch.status = "failed";
  }

  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true });

  try {
    const supabase = getSupabaseServerClient();
    await supabase.from("whatsapp_messages").update(patch).eq("interakt_message_id", messageId);
  } catch (err) {
    console.error("Failed to process Interakt webhook", err);
  }

  return NextResponse.json({ ok: true });
}
