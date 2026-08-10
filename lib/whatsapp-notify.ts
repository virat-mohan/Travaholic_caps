import { getSetting } from "@/lib/settings";

type OrderForWhatsApp = { id: string; customer_name: string; customer_phone: string; total: number };

/**
 * Sends an order-confirmation WhatsApp message via Interakt.
 * Assumes an approved WhatsApp template named "order_confirmation" with
 * three body variables: customer name, order number, total — create that
 * template in the Interakt dashboard before this will actually deliver.
 */
export async function sendOrderConfirmationWhatsApp(order: OrderForWhatsApp) {
  const apiKey = await getSetting("INTERAKT_API_KEY");
  if (!apiKey) {
    console.log("INTERAKT_API_KEY not set — skipping WhatsApp confirmation for order", order.id);
    return;
  }

  const phoneDigits = order.customer_phone.replace(/\D/g, "").slice(-10);

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
        template: {
          name: "order_confirmation",
          languageCode: "en",
          bodyValues: [
            order.customer_name,
            order.id.slice(0, 8).toUpperCase(),
            `₹${order.total.toLocaleString("en-IN")}`,
          ],
        },
      }),
    });
    if (!res.ok) {
      console.error("Interakt WhatsApp send failed", res.status, await res.text());
    }
  } catch (err) {
    console.error("Interakt WhatsApp send failed", err);
  }
}
