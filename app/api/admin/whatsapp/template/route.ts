import { NextResponse } from "next/server";
import { checkVoice, hasBlock, describeBlocks } from "@/lib/brand-voice";
import { getSupabaseServerClient } from "@/lib/supabase";
import { sendMsg91Template } from "@/lib/msg91";
import { logOutboundWhatsAppMessage } from "@/lib/whatsapp-inbox";
import { supportFollowupStatus } from "@/lib/msg91-templates";
import { SUPPORT_TEMPLATE, firstNameOrThere, renderSupportBody } from "@/lib/support-template";

// Admin-only (proxy.ts gates /api/admin/*, same as the reply route).

/** Is the follow-up template approved and sendable yet? */
export async function GET() {
  return NextResponse.json(await supportFollowupStatus());
}

/** Sends support_followup to a thread outside the 24-hour window and logs it as outbound. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.conversationId) return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });

  try {
    const { usable } = await supportFollowupStatus();
    if (!usable) return NextResponse.json({ error: "Template pending Meta approval" }, { status: 409 });

    const supabase = getSupabaseServerClient();
    const { data: conversation } = await supabase
      .from("whatsapp_conversations")
      .select("customer_phone, customer_name")
      .eq("id", body.conversationId)
      .maybeSingle();
    if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

    let customerName: string | null = null;
    if (!conversation.customer_name) {
      const digits = String(conversation.customer_phone).replace(/\D/g, "").slice(-10);
      const { data: customer } = await supabase
        .from("customers")
        .select("name")
        .ilike("phone", `%${digits}`)
        .limit(1)
        .maybeSingle();
      customerName = (customer as { name?: string } | null)?.name ?? null;
    }
    const firstName = firstNameOrThere(conversation.customer_name, customerName);

    // Brand book lock: the exact text the customer sees is checked first.
    const voice = checkVoice(renderSupportBody(firstName), "whatsapp");
    if (hasBlock(voice)) return NextResponse.json({ error: `Brand voice: ${describeBlocks(voice)}` }, { status: 422 });

    const result = await sendMsg91Template(SUPPORT_TEMPLATE.name, conversation.customer_phone, [firstName]);
    await logOutboundWhatsAppMessage({
      conversationId: body.conversationId,
      body: renderSupportBody(firstName),
      providerMessageId: result.sent ? result.messageId : undefined,
      status: result.sent ? "sent" : "failed",
    });
    if (!result.sent) return NextResponse.json({ error: "Could not send template" }, { status: 500 });
    return NextResponse.json({ ok: true, body: renderSupportBody(firstName) });
  } catch (err) {
    console.error("Failed to send follow-up template", err);
    return NextResponse.json({ error: "Could not send template" }, { status: 500 });
  }
}
