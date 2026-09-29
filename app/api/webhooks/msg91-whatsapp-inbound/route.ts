import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";
import { getSupabaseServerClient } from "@/lib/supabase";
import { logInboundWhatsAppMessage, logOutboundWhatsAppMessage } from "@/lib/whatsapp-inbox";
import { sendWhatsAppSessionMessage, sendMsg91Template } from "@/lib/msg91";

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

  const phone =
    body.customerNumber ??
    body.customer_number ??
    msg?.from ??
    msg?.sender ??
    msg?.mobile ??
    body.from ??
    body.mobile ??
    null;

  const receivingNumber =
    body.integratedNumber ??
    body.integrated_number ??
    msg?.integrated_number ??
    null;

  const text = msg?.text?.body ?? msg?.body ?? msg?.message ?? body.text ?? null;
  const name = contact?.profile?.name ?? body.customerName ?? msg?.name ?? body.name ?? null;
  const mediaUrl = msg?.image?.link ?? msg?.media?.url ?? body.media_url ?? null;
  const providerMessageId = body.uuid ?? msg?.id ?? msg?.message_id ?? body.message_id ?? null;

  if (!phone) {
    console.error("MSG91 inbound webhook: unrecognized payload shape", JSON.stringify(body));
    return NextResponse.json({ ok: true });
  }

  // 1. Deduplication check: Has this exact message ID (wamid) already been handled?
  if (providerMessageId) {
    try {
      const supabase = getSupabaseServerClient();
      const { data: existingMsg } = await supabase
        .from("whatsapp_conversation_messages")
        .select("id")
        .eq("provider_message_id", String(providerMessageId))
        .maybeSingle();

      if (existingMsg) {
        console.log("MSG91 inbound webhook: Duplicate message ID ignored", providerMessageId);
        return NextResponse.json({ ok: true, duplicate: true });
      }
    } catch (e) {
      console.warn("Failed to check duplicate provider_message_id", e);
    }
  }

  // Parse order items defensively across MSG91 stringified json, object, or Cloud API order
  let rawOrderData: { catalog_id?: string; product_items?: Array<{ product_retailer_id?: string; quantity?: number; item_price?: number; currency?: string }> } | null = null;

  if (typeof body.orders === "string" && body.orders.trim()) {
    try {
      rawOrderData = JSON.parse(body.orders);
    } catch (e) {
      console.warn("Failed to parse body.orders JSON string", e);
    }
  } else if (body.orders && typeof body.orders === "object") {
    rawOrderData = body.orders;
  } else if (msg?.order && typeof msg.order === "object") {
    rawOrderData = msg.order;
  }

  const rawProductItems = rawOrderData?.product_items ?? [];
  const orderItems = Array.isArray(rawProductItems)
    ? rawProductItems.filter((i) => i && i.product_retailer_id)
    : [];

  const cartSuffix = orderItems
    .map((i) => `${i.product_retailer_id}:${i.quantity ?? 1}`)
    .join(",");

  let totalAmount = 0;
  const itemBulletPoints: string[] = [];

  for (const item of orderItems) {
    const qty = Number(item.quantity) || 1;
    const price = Number(item.item_price) || 1399;
    totalAmount += price * qty;
    const rawId = item.product_retailer_id || "travaholic-cap";
    const formattedTitle = rawId
      .replace(/[-_]/g, " ")
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    itemBulletPoints.push(`• ${qty}x ${formattedTitle} (₹${price.toLocaleString("en-IN")})`);
  }

  if (orderItems.length > 0 && totalAmount === 0) {
    totalAmount = 1399 * orderItems.length;
  }

  const orderSummary = cartSuffix ? `🛒 Catalogue cart: ${cartSuffix} (₹${totalAmount.toLocaleString("en-IN")})` : null;

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

  if (orderItems.length > 0) {
    // 2. Debounce check: If an outbound order reply was already sent to this conversation in the last 20 seconds, skip
    if (conversationId) {
      try {
        const supabase = getSupabaseServerClient();
        const twentySecAgo = new Date(Date.now() - 20 * 1000).toISOString();
        const { data: recentReply } = await supabase
          .from("whatsapp_conversation_messages")
          .select("id")
          .eq("conversation_id", conversationId)
          .eq("direction", "outbound")
          .gte("created_at", twentySecAgo)
          .maybeSingle();

        if (recentReply) {
          console.log("MSG91 inbound webhook: Recent reply sent to this conversation in last 20s, skipping duplicate");
          return NextResponse.json({ ok: true, duplicate: true });
        }
      } catch (e) {
        console.warn("Failed to check recent conversation reply debounce", e);
      }
    }

    const firstName = name ? String(name).trim().split(" ")[0] : "there";
    const itemsListText = itemBulletPoints.join("\n");
    const formattedTotal = `₹${totalAmount.toLocaleString("en-IN")}`;
    const websiteCartLink = `https://www.travaholic.in/cart?items=${encodeURIComponent(cartSuffix)}`;
    const headerImageUrl = `https://www.travaholic.in/api/og/cart?items=${encodeURIComponent(cartSuffix)}`;

    const templateName = (await getSetting("MSG91_CART_CHECKOUT_TEMPLATE_ID")) || "travaholic_cart_checkout";
    const itemsSummaryForTemplate = itemBulletPoints.map((p) => p.replace(/^•\s*/, "")).join("\n• ");

    // 1. Try sending the official MSG91 WhatsApp Template with Card Image & [Pay on Site] CTA button
    let sentMessageId: string | null = null;
    let sendSuccess = false;

    const templateResult = await sendMsg91Template(
      templateName,
      String(phone),
      [firstName, itemsSummaryForTemplate, formattedTotal],
      { type: "image", url: headerImageUrl },
      encodeURIComponent(cartSuffix)
    );

    if (templateResult.sent) {
      sendSuccess = true;
      sentMessageId = templateResult.messageId ?? null;
    } else {
      // Fallback: If template is still pending Meta approval, send clean session reply with Pay on Site link
      const fallbackReply = `Hi ${firstName}! 🧢 Thanks for choosing Travaholic.\n\n📦 *Order Summary:*\n${itemsListText}\n\n💰 *Total Amount:* ${formattedTotal} (Free Express Delivery)\n\nYour cart is ready. Tap below to complete your order securely on our site:\n${websiteCartLink}`;

      const sessionResult = await sendWhatsAppSessionMessage(
        String(phone),
        fallbackReply,
        receivingNumber ? String(receivingNumber) : undefined
      );

      sendSuccess = sessionResult.sent;
      sentMessageId = sessionResult.sent ? sessionResult.messageId ?? null : null;
    }

    if (conversationId) {
      await logOutboundWhatsAppMessage({
        conversationId,
        body: `[Cart Checkout] ${sendSuccess ? "sent" : "failed"} (Total: ${formattedTotal})`,
        providerMessageId: sentMessageId,
        status: sendSuccess ? "sent" : "failed",
      }).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true });
}
