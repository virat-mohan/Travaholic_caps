import { getSetting } from "@/lib/settings";
import { renderInvoiceHtml } from "@/lib/invoice";

type InvoiceOrder = Parameters<typeof renderInvoiceHtml>[0];
type InvoiceItem = Parameters<typeof renderInvoiceHtml>[1][number];

export async function sendInvoiceEmail(order: InvoiceOrder, items: InvoiceItem[]) {
  const apiKey = await getSetting("RESEND_API_KEY");
  if (!apiKey) {
    console.log("RESEND_API_KEY not set — skipping invoice email for order", order.id);
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Travaholic <orders@travaholic.in>",
        to: order.customer_email,
        subject: `Your Travaholic Invoice — Order #${order.id.slice(0, 8).toUpperCase()}`,
        html: renderInvoiceHtml(order, items),
      }),
    });
    if (!res.ok) {
      console.error("Resend invoice email failed", res.status, await res.text());
    }
  } catch (err) {
    console.error("Resend invoice email failed", err);
  }
}
