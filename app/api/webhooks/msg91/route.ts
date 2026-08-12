import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

/**
 * MSG91's delivery/read status webhook — configure this URL under MSG91
 * dashboard → Settings → DLR/Webhook. Exact payload field names haven't
 * been verified against a live account yet; this reads defensively across
 * the most commonly documented field names and needs a check against real
 * payloads once MSG91 is actually sending traffic.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: true });

  const messageId = body.request_id ?? body.requestId ?? body.messageId ?? body.message_id;
  const rawStatus = (body.status ?? body.event ?? "").toString().toLowerCase();

  if (!messageId || !rawStatus) return NextResponse.json({ ok: true });

  const patch: Record<string, string> = {};
  if (rawStatus.includes("read") || rawStatus.includes("seen")) {
    patch.status = "read";
    patch.read_at = new Date().toISOString();
  } else if (rawStatus.includes("delivered")) {
    patch.status = "delivered";
    patch.delivered_at = new Date().toISOString();
  } else if (rawStatus.includes("fail") || rawStatus.includes("undelivered")) {
    patch.status = "failed";
  }

  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true });

  try {
    const supabase = getSupabaseServerClient();
    await supabase.from("whatsapp_messages").update(patch).eq("msg91_message_id", messageId);
  } catch (err) {
    console.error("Failed to process MSG91 webhook", err);
  }

  return NextResponse.json({ ok: true });
}
