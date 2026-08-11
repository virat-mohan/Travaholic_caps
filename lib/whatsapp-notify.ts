import { getSetting } from "@/lib/settings";
import { getSupabaseServerClient } from "@/lib/supabase";

type OrderForWhatsApp = { id: string; customer_name: string; customer_phone: string; total: number };
type CartSessionForWhatsApp = {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  items: { name: string; quantity: number }[];
};

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

    // Best-effort logging for open-rate/conversion reporting — a failure
    // here must never look like the WhatsApp send itself failed.
    try {
      const supabase = getSupabaseServerClient();
      await supabase.from("whatsapp_messages").insert({
        cart_session_id: logAgainst.cartSessionId ?? null,
        order_id: logAgainst.orderId ?? null,
        interakt_message_id: data?.id ?? data?.result?.id ?? null,
        template_name: templateName,
      });
    } catch (err) {
      console.error("Failed to log whatsapp_messages row", err);
    }

    return true;
  } catch (err) {
    console.error("Interakt WhatsApp send failed", err);
    return false;
  }
}

/**
 * Sends an order-confirmation WhatsApp message via Interakt.
 * Assumes an approved WhatsApp template named "order_confirmation" with
 * three body variables: customer name, order number, total — create that
 * template in the Interakt dashboard before this will actually deliver.
 */
export async function sendOrderConfirmationWhatsApp(order: OrderForWhatsApp) {
  await sendInteraktTemplate(
    order.customer_phone,
    "order_confirmation",
    [order.customer_name, order.id.slice(0, 8).toUpperCase(), `₹${order.total.toLocaleString("en-IN")}`],
    { orderId: order.id }
  );
}

/**
 * Sends an abandoned-cart nudge via Interakt. Assumes an approved template
 * named "abandoned_cart" with two body variables: customer name, item
 * summary. Called from the abandon-sweep cron/route, never more than once
 * per session (caller is responsible for checking retargeted_at first).
 */
export async function sendAbandonedCartWhatsApp(session: CartSessionForWhatsApp) {
  if (!session.customer_phone) return false;
  const itemSummary = session.items.map((i) => `${i.quantity}x ${i.name}`).join(", ");
  return sendInteraktTemplate(
    session.customer_phone,
    "abandoned_cart",
    [session.customer_name ?? "there", itemSummary || "your cart"],
    { cartSessionId: session.id }
  );
}
