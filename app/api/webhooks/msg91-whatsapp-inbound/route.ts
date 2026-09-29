import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";
import { getSupabaseServerClient } from "@/lib/supabase";
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
    const configuredUpiVpa = await getSetting("BUSINESS_UPI_ID");
    const upiVpa = configuredUpiVpa || "viratmohan-1@okhdfcbank";
    const configuredPayeeName = await getSetting("BUSINESS_UPI_NAME");
    const payeeName = configuredPayeeName || "Travaholic Caps";

    const firstItem = orderItems[0]?.product_retailer_id ?? "cap";
    const oneTapUpiLink = `https://www.travaholic.in/pay/upi?am=${totalAmount}&item=${encodeURIComponent(firstItem)}`;
    const qrCodeUrl = `https://www.travaholic.in/pay/qr?am=${totalAmount}&item=${encodeURIComponent(firstItem)}`;
    const websiteCartLink = `https://www.travaholic.in/cart?items=${encodeURIComponent(cartSuffix)}`;

    const reply = `Hi ${firstName}! 🧢 Thanks for choosing Travaholic.

📦 *Order Summary:*
${itemsListText}
💰 *Total Amount:* ₹${totalAmount.toLocaleString("en-IN")} (Free Express Shipping)

━━━━━━━━━━━━━━━━━━━
📲 *1-Tap Pay via UPI (GPay / PhonePe / Paytm):*
${oneTapUpiLink}

📸 *Or Scan QR Code to Pay:*
${qrCodeUrl}

💳 *Or Pay Directly to UPI ID:*
\`${upiVpa}\`
━━━━━━━━━━━━━━━━━━━

🚚 *Next Step to Dispatch:*
Once paid, reply with a screenshot here and your complete shipping address. We will pack and dispatch your order right away!

(Prefer paying with Cards/NetBanking? Pay on site: ${websiteCartLink})`;

    const sent = await sendWhatsAppSessionMessage(
      String(phone),
      reply,
      receivingNumber ? String(receivingNumber) : undefined
    );
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
