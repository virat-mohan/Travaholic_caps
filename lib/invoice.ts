import { getBrandProfile } from "@/lib/brand";

type InvoiceOrder = {
  id: string;
  created_at: string;
  customer_name: string;
  customer_email: string;
  delivery_address: string;
  subtotal: number;
  discount_amount: number;
  total: number;
};

type InvoiceItem = { chapter_name: string; unit_price: number; quantity: number };

export async function renderInvoiceHtml(order: InvoiceOrder, items: InvoiceItem[]) {
  const brand = await getBrandProfile();
  const logoUrl = `${brand.siteUrl.replace(/\/$/, "")}/images/brand/travaholic-logo-color-v2.png`;

  const date = new Date(order.created_at).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const rows = items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px 0;">${item.chapter_name}</td>
          <td style="padding:8px 0;text-align:center;">${item.quantity}</td>
          <td style="padding:8px 0;text-align:right;">₹${item.unit_price.toLocaleString("en-IN")}</td>
          <td style="padding:8px 0;text-align:right;">₹${(item.unit_price * item.quantity).toLocaleString("en-IN")}</td>
        </tr>`
    )
    .join("");

  return `
    <div style="max-width:600px;margin:0 auto;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;">
      <img src="${logoUrl}" alt="${brand.brandName}" width="120" style="display:block;margin:0 auto 24px;" />
      <p style="color:#666;font-size:13px;text-align:center;">Invoice for Order #${order.id.slice(0, 8).toUpperCase()} · ${date}</p>

      <table style="width:100%;margin-top:24px;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="border-bottom:1px solid #ddd;text-align:left;font-size:12px;text-transform:uppercase;color:#666;">
            <th style="padding-bottom:8px;">Item</th>
            <th style="padding-bottom:8px;text-align:center;">Qty</th>
            <th style="padding-bottom:8px;text-align:right;">Price</th>
            <th style="padding-bottom:8px;text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div style="margin-top:16px;border-top:1px solid #ddd;padding-top:12px;font-size:14px;">
        <div style="display:flex;justify-content:space-between;"><span>Subtotal</span><span>₹${order.subtotal.toLocaleString("en-IN")}</span></div>
        ${
          order.discount_amount > 0
            ? `<div style="display:flex;justify-content:space-between;color:#b8860b;"><span>Discount</span><span>−₹${order.discount_amount.toLocaleString("en-IN")}</span></div>`
            : ""
        }
        <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:16px;margin-top:8px;"><span>Total</span><span>₹${order.total.toLocaleString("en-IN")}</span></div>
      </div>

      <div style="margin-top:24px;font-size:13px;color:#666;">
        <p>Billed to: ${order.customer_name}</p>
        <p>Delivery address: ${order.delivery_address}</p>
      </div>

      <p style="margin-top:32px;font-size:12px;color:#999;">Travaholic · C-152, Okhla Industrial Area Phase-1, Delhi, South Delhi, 110025</p>
    </div>
  `;
}
