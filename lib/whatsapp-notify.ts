import { getSetting } from "@/lib/settings";
import { getSupabaseServerClient } from "@/lib/supabase";
import { sendMsg91Flow } from "@/lib/msg91";
import { generateAndUploadOrderCard } from "@/lib/order-card";

type OrderForWhatsApp = { id: string; customer_name: string; customer_phone: string; total: number };
type OrderItemForCard = { chapter_name: string; quantity: number };
type CartSessionForWhatsApp = {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  items: { name: string; quantity: number }[];
};

async function logSend(
  messageId: string | null | undefined,
  templateName: string,
  logAgainst: { cartSessionId?: string; orderId?: string }
) {
  try {
    const supabase = getSupabaseServerClient();
    await supabase.from("whatsapp_messages").insert({
      cart_session_id: logAgainst.cartSessionId ?? null,
      order_id: logAgainst.orderId ?? null,
      provider: "msg91",
      msg91_message_id: messageId ?? null,
      template_name: templateName,
    });
  } catch (err) {
    console.error("Failed to log whatsapp_messages row", err);
  }
}

async function sendTemplate(
  phone: string,
  templateName: string,
  msg91TemplateId: string | null,
  variables: string[],
  logAgainst: { cartSessionId?: string; orderId?: string },
  mediaUrl?: string
) {
  const result = await sendMsg91Flow(msg91TemplateId, phone, variables, mediaUrl);
  if (result.sent) {
    await logSend(result.messageId, templateName, logAgainst);
    return true;
  }
  return false;
}

/**
 * Sends an order-confirmation WhatsApp message via MSG91, with a branded
 * "Order Confirmed" card (generated via @vercel/og) as the template's header
 * image — WhatsApp doesn't render HTML, so an image + formatted text is the
 * closest equivalent to a designed email. Needs a Flow with an image header
 * and three body variables in order: customer name, order number, total —
 * set its ID as MSG91_ORDER_CONFIRMATION_TEMPLATE_ID in /admin/settings.
 */
export async function sendOrderConfirmationWhatsApp(order: OrderForWhatsApp, items: OrderItemForCard[] = []) {
  const msg91TemplateId = await getSetting("MSG91_ORDER_CONFIRMATION_TEMPLATE_ID");
  const variables = [
    order.customer_name,
    order.id.slice(0, 8).toUpperCase(),
    `₹${order.total.toLocaleString("en-IN")}`,
  ];

  let cardUrl: string | undefined;
  try {
    cardUrl = await generateAndUploadOrderCard(order, items);
  } catch (err) {
    console.error("Failed to generate order confirmation card — sending without it", err);
  }

  await sendTemplate(
    order.customer_phone,
    "order_confirmation",
    msg91TemplateId,
    variables,
    { orderId: order.id },
    cardUrl
  );
}

/**
 * Sends an abandoned-cart nudge via MSG91. Needs a Flow with two variables:
 * customer name, item summary — set its ID as
 * MSG91_ABANDONED_CART_TEMPLATE_ID in /admin/settings. Called from the
 * abandon-sweep cron/route, never more than once per session (caller checks
 * retargeted_at first).
 */
export async function sendAbandonedCartWhatsApp(session: CartSessionForWhatsApp) {
  if (!session.customer_phone) return false;
  const itemSummary = session.items.map((i) => `${i.quantity}x ${i.name}`).join(", ") || "your cart";
  const msg91TemplateId = await getSetting("MSG91_ABANDONED_CART_TEMPLATE_ID");
  const variables = [session.customer_name ?? "there", itemSummary];
  return sendTemplate(session.customer_phone, "abandoned_cart", msg91TemplateId, variables, {
    cartSessionId: session.id,
  });
}

/**
 * Sends a nudge after a failed delivery attempt (NDR) — this is the actual
 * RTO-prevention intervention, since it lands in the window before Shiprocket
 * gives up and sends the shipment back. Needs a Flow with two variables:
 * customer name, order number — set its ID as MSG91_NDR_TEMPLATE_ID in
 * /admin/settings. Called from the Shiprocket webhook on the state
 * transition into an NDR status, not on every webhook hit while already in
 * that status, so a retried webhook can't spam the customer repeatedly.
 */
export async function sendNdrWhatsApp(order: OrderForWhatsApp) {
  const msg91TemplateId = await getSetting("MSG91_NDR_TEMPLATE_ID");
  const variables = [order.customer_name, order.id.slice(0, 8).toUpperCase()];
  return sendTemplate(order.customer_phone, "ndr_nudge", msg91TemplateId, variables, {
    orderId: order.id,
  });
}

/**
 * Sends a referral invite by WhatsApp — best-effort alongside the email,
 * which always sends regardless since it needs no template approval. Needs
 * a Flow with three variables: friend name, referrer name, referral link —
 * set its ID as MSG91_REFERRAL_INVITE_TEMPLATE_ID in /admin/settings.
 */
export async function sendReferralInviteWhatsApp(
  friendPhone: string,
  friendName: string,
  referrerName: string,
  referralUrl: string
) {
  const msg91TemplateId = await getSetting("MSG91_REFERRAL_INVITE_TEMPLATE_ID");
  const variables = [friendName, referrerName, referralUrl];
  return sendTemplate(friendPhone, "referral_invite", msg91TemplateId, variables, {});
}

/** Retention nudge by WhatsApp — best-effort alongside the email, which always sends regardless. */
export async function sendWinbackWhatsApp(phone: string, name: string, milesBalance: number) {
  const msg91TemplateId = await getSetting("MSG91_WINBACK_TEMPLATE_ID");
  const variables = [name, String(milesBalance)];
  return sendTemplate(phone, "winback", msg91TemplateId, variables, {});
}
