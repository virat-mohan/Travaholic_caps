import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";
import { logInboundWhatsAppMessage, logOutboundWhatsAppMessage } from "@/lib/whatsapp-inbox";
import { sendWhatsAppSessionMessage } from "@/lib/msg91";

/**
 * MSG91's inbound-WhatsApp webhook — configure this URL under MSG91
 * dashboard → WhatsApp → Settings → Webhook (separate from the DLR/status
 * webhook at /api/webhooks/msg91). Exact payload field names haven't been
 * verified against a live incoming message yet — this reads defensively
 * across a few plausible shapes (a flat object, or a Cloud-API-style
 * `messages[]` array, which MSG91 sometimes mirrors) and logs the raw body
 * on anything unrecognized so the first real message is easy to diagnose.
 */
export async function POST(request: Request) {
  const expectedToken = await getSetting("MSG91_INBOUND_WEBHOOK_TOKEN");
  const providedToken = request.headers.get("x-webhook-token") ?? new URL(request.url).searchParams.get("token");
  if (expectedToken && providedToken !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: true });

  // Some BSPs (and MSG91, per their docs) wrap inbound events in a
  // Cloud-API-style `messages` array alongside a `contacts` array for the
  // sender's name — unwrap that first if present, otherwise treat the body
  // itself as the single message.
  const msg = Array.isArray(body.messages) ? body.messages[0] : body;
  const contact = Array.isArray(body.contacts) ? body.contacts[0] : undefined;

  const phone = msg?.from ?? msg?.sender ?? msg?.mobile ?? body.from ?? body.mobile ?? null;
  const text = msg?.text?.body ?? msg?.body ?? msg?.message ?? body.text ?? null;
  const name = contact?.profile?.name ?? msg?.name ?? body.name ?? null;
  const mediaUrl = msg?.image?.link ?? msg?.media?.url ?? body.media_url ?? null;
  const providerMessageId = msg?.id ?? msg?.message_id ?? body.message_id ?? null;

  if (!phone) {
    console.error("MSG91 inbound webhook: unrecognized payload shape", JSON.stringify(body));
    return NextResponse.json({ ok: true });
  }

  // A cart sent from the WhatsApp catalogue arrives as an "order" message.
  // Catalogue product ids are the site's chapter slugs (see /api/product-feed),
  // so it maps 1:1 onto the /cart deep link — the customer lands on checkout
  // with their cart filled, pays, and the normal flow ships it.
  const orderItems = (msg?.order?.product_items ?? []) as { product_retailer_id?: string; quantity?: number }[];
  const cartSuffix = orderItems
    .filter((i) => i.product_retailer_id)
    .map((i) => `${i.product_retailer_id}:${i.quantity ?? 1}`)
    .join(",");
  const orderSummary = cartSuffix ? `🛒 Catalogue cart: ${cartSuffix}` : null;

  let conversationId: string | null = null;
  try {
    conversationId = await logInboundWhatsAppMessage({
      phone: String(phone),
      body: text ?? orderSummary ?? "",
      customerName: name,
      mediaUrl,
      providerMessageId: providerMessageId ? String(providerMessageId) : null,
    });
  } catch (err) {
    console.error("Failed to log inbound WhatsApp message", err);
  }

  if (cartSuffix) {
    const reply = `Thanks${name ? `, ${String(name).split(" ")[0]}` : ""}! Your cart is ready. Add your address and pay securely here (free shipping, Buy 3 Get 1 Free applied automatically):\nhttps://www.travaholic.in/cart?items=${encodeURIComponent(cartSuffix)}&utm_source=whatsapp&utm_medium=catalogue`;
    const sent = await sendWhatsAppSessionMessage(String(phone), reply);
    if (conversationId) {
      await logOutboundWhatsAppMessage({
        conversationId,
        body: reply,
        providerMessageId: sent.sent ? sent.messageId ?? null : null,
        status: sent.sent ? "sent" : "failed",
      }).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true });
}
