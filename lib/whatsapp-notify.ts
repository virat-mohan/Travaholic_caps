import { getSetting } from "@/lib/settings";
import { getSupabaseServerClient } from "@/lib/supabase";
import { sendMsg91Flow } from "@/lib/msg91";

type OrderForWhatsApp = { id: string; customer_name: string; customer_phone: string; total: number };
type CartSessionForWhatsApp = {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  items: { name: string; quantity: number }[];
};

async function logSend(
  provider: "msg91" | "interakt",
  messageId: string | null | undefined,
  templateName: string,
  logAgainst: { cartSessionId?: string; orderId?: string }
) {
  try {
    const supabase = getSupabaseServerClient();
    await supabase.from("whatsapp_messages").insert({
      cart_session_id: logAgainst.cartSessionId ?? null,
      order_id: logAgainst.orderId ?? null,
      provider,
      msg91_message_id: provider === "msg91" ? messageId ?? null : null,
      interakt_message_id: provider === "interakt" ? messageId ?? null : null,
      template_name: templateName,
    });
  } catch (err) {
    console.error("Failed to log whatsapp_messages row", err);
  }
}

async function sendInteraktTemplate(
  phone: string,
  templateName: string,
  bodyValues: string[],
  logAgainst: { cartSessionId?: string; orderId?: string }
) {
  const apiKey = await getSetting("INTERAKT_API_KEY");
  if (!apiKey) {
    console.log(`INTERAKT_API_KEY not set — skipping WhatsApp send (${templateName})`);
    return false;
  }

  const phoneDigits = phone.replace(/\D/g, "").slice(-10);

  try {
    const res = await fetch("https://api.interakt.ai/v1/public/message/", {
      method: "POST",
      headers: {
        Authorization: `Basic ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        countryCode: "+91",
        phoneNumber: phoneDigits,
        type: "Template",
        template: { name: templateName, languageCode: "en", bodyValues },
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      console.error("Interakt WhatsApp send failed", res.status, data);
      return false;
    }

    await logSend("interakt", data?.id ?? data?.result?.id ?? null, templateName, logAgainst);
    return true;
  } catch (err) {
    console.error("Interakt WhatsApp send failed", err);
    return false;
  }
}

/**
 * Sends a WhatsApp template via MSG91 first, falling back to the matching
 * Interakt template if MSG91 isn't configured for this message type yet —
 * so migrating one template at a time (or not at all) never breaks sending.
 */
async function sendTemplate(
  phone: string,
  templateName: string,
  msg91TemplateId: string | null,
  variables: string[],
  interaktBodyValues: string[],
  logAgainst: { cartSessionId?: string; orderId?: string }
) {
  const msg91Result = await sendMsg91Flow(msg91TemplateId, phone, variables);
  if (msg91Result.sent) {
    await logSend("msg91", msg91Result.messageId, templateName, logAgainst);
    return true;
  }

  return sendInteraktTemplate(phone, templateName, interaktBodyValues, logAgainst);
}

/**
 * Sends an order-confirmation WhatsApp message. Needs a template with three
 * variables (in order): customer name, order number, total — as an MSG91
 * Flow (MSG91_ORDER_CONFIRMATION_TEMPLATE_ID) and/or an approved Interakt
 * template named "order_confirmation".
 */
export async function sendOrderConfirmationWhatsApp(order: OrderForWhatsApp) {
  const msg91TemplateId = await getSetting("MSG91_ORDER_CONFIRMATION_TEMPLATE_ID");
  const variables = [
    order.customer_name,
    order.id.slice(0, 8).toUpperCase(),
    `₹${order.total.toLocaleString("en-IN")}`,
  ];
  await sendTemplate(
    order.customer_phone,
    "order_confirmation",
    msg91TemplateId,
    variables,
    variables,
    { orderId: order.id }
  );
}

/**
 * Sends an abandoned-cart nudge. Needs a template with two variables:
 * customer name, item summary — as an MSG91 Flow
 * (MSG91_ABANDONED_CART_TEMPLATE_ID) and/or an approved Interakt template
 * named "abandoned_cart". Called from the abandon-sweep cron/route, never
 * more than once per session (caller checks retargeted_at first).
 */
export async function sendAbandonedCartWhatsApp(session: CartSessionForWhatsApp) {
  if (!session.customer_phone) return false;
  const itemSummary = session.items.map((i) => `${i.quantity}x ${i.name}`).join(", ") || "your cart";
  const msg91TemplateId = await getSetting("MSG91_ABANDONED_CART_TEMPLATE_ID");
  const variables = [session.customer_name ?? "there", itemSummary];
  return sendTemplate(
    session.customer_phone,
    "abandoned_cart",
    msg91TemplateId,
    variables,
    variables,
    { cartSessionId: session.id }
  );
}

/**
 * Sends a login OTP via Interakt. Only used as a fallback — requestOtp() in
 * lib/auth.ts tries MSG91 first via sendOtpViaMsg91.
 */
export async function sendOtpWhatsApp(phone: string, code: string) {
  return sendInteraktTemplate(phone, "login_otp", [code], {});
}
