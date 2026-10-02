import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { canReplyFreeForm, lastInboundByConversation } from "@/lib/whatsapp-window";

/** Lists every conversation, most recently active first. */
export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("whatsapp_conversations")
      .select("*")
      .order("last_message_at", { ascending: false });
    if (error) throw error;
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data: inbound } = await supabase
      .from("whatsapp_conversation_messages")
      .select("conversation_id, created_at")
      .eq("direction", "inbound")
      .gte("created_at", since);
    const last = lastInboundByConversation(inbound ?? []);
    const conversations = (data ?? []).map((c) => ({
      ...c,
      last_inbound_at: last[c.id] ?? null,
      can_reply: canReplyFreeForm(last[c.id]),
    }));
    return NextResponse.json({ conversations });
  } catch (err) {
    console.error("Failed to list WhatsApp conversations", err);
    return NextResponse.json({ conversations: [] }, { status: 500 });
  }
}
