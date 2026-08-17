import { getBrandProfile } from "@/lib/brand";
import { getSetting } from "@/lib/settings";
import { getOrCreateReferralCode } from "@/lib/referrals";

type InvoiceOrder = {
  id: string;
  created_at: string;
  customer_name: string;
  customer_email: string;
  delivery_address: string;
  delivery_city?: string | null;
  delivery_state?: string | null;
  delivery_pincode?: string | null;
  subtotal: number;
  discount_amount: number;
  shipping_charge?: number;
  total: number;
  payment_type?: string;
  cod_advance_amount?: number;
  balance_due?: number;
  customer_id?: string | null;
};

type InvoiceItem = { chapter_name: string; unit_price: number; quantity: number };

export async function renderInvoiceHtml(order: InvoiceOrder, items: InvoiceItem[]) {
  const brand = await getBrandProfile();
  const logoUrl = `${brand.siteUrl.replace(/\/$/, "")}/images/brand/travaholic-logo-email.png`;

  const date = new Date(order.created_at).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const fullAddress = [order.delivery_address, order.delivery_city, order.delivery_state, order.delivery_pincode]
    .filter(Boolean)
    .join(", ");

  const capsBought = items.reduce((sum, item) => sum + item.quantity, 0);
  const milesPerCapSetting = await getSetting("MILES_PER_CAP");
  const milesPerCap = milesPerCapSetting ? Number(milesPerCapSetting) : 250;
  const milesEarned = capsBought * milesPerCap;

  // Every order now has a customer record behind it (guest checkout gets
  // one too, see findOrCreateCustomerForGuest) — invoice is the one
  // touchpoint every customer reads, so it's the natural place to plant
  // the referral code even for someone who never visits /account.
  let referralSection = "";
  if (order.customer_id) {
    const [referralCode, discountSetting] = await Promise.all([
      getOrCreateReferralCode(order.customer_id),
      getSetting("REFERRAL_DISCOUNT_RUPEES"),
    ]);
    const discountRupees = discountSetting ? Number(discountSetting) : 200;
    referralSection = `
      <div style="margin-top:24px;border-top:1px solid #333;padding-top:16px;text-align:center;">
        <p style="font-size:13px;color:#ccc;">Know someone who'd love ${brand.brandName}?</p>
        <p style="font-size:13px;color:#ccc;margin-top:4px;">Share your code <strong style="color:#ffffff;">${referralCode}</strong> — they get ₹${discountRupees} off, and you earn Miles when they buy.</p>
        <p style="font-size:11px;color:#777;margin-top:6px;">Terms and conditions apply.</p>
      </div>
    `;
  }

  const rows = items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px 0;">Trucker Cap — ${item.chapter_name}</td>
          <td style="padding:8px 0;text-align:center;">${item.quantity}</td>
          <td style="padding:8px 0;text-align:right;">₹${item.unit_price.toLocaleString("en-IN")}</td>
          <td style="padding:8px 0;text-align:right;">₹${(item.unit_price * item.quantity).toLocaleString("en-IN")}</td>
        </tr>`
    )
    .join("");

  return `
    <div style="max-width:600px;margin:0 auto;background-color:#0a0a0a;font-family:Helvetica,Arial,sans-serif;color:#f5f5f5;">
      <div style="background-color:#0a0a0a;padding:16px 0;text-align:center;">
        <img src="${logoUrl}" alt="${brand.brandName}" width="120" style="display:inline-block;" />
      </div>
      <p style="color:#aaa;font-size:13px;text-align:center;">Invoice for Order #${order.id.slice(0, 8).toUpperCase()} · ${date}</p>

      <table style="width:100%;margin-top:24px;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="border-bottom:1px solid #333;text-align:left;font-size:12px;text-transform:uppercase;color:#aaa;">
            <th style="padding-bottom:8px;">Item</th>
            <th style="padding-bottom:8px;text-align:center;">Qty</th>
            <th style="padding-bottom:8px;text-align:right;">Price</th>
            <th style="padding-bottom:8px;text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div style="margin-top:16px;border-top:1px solid #333;padding-top:12px;font-size:14px;">
        <div style="display:flex;justify-content:space-between;"><span>Subtotal</span><span>₹${order.subtotal.toLocaleString("en-IN")}</span></div>
        ${
          order.discount_amount > 0
            ? `<div style="display:flex;justify-content:space-between;color:#e0b84a;"><span>Discount</span><span>−₹${order.discount_amount.toLocaleString("en-IN")}</span></div>`
            : ""
        }
        ${
          order.shipping_charge
            ? `<div style="display:flex;justify-content:space-between;"><span>Shipping</span><span>₹${order.shipping_charge.toLocaleString("en-IN")}</span></div>`
            : ""
        }
        <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:16px;margin-top:8px;color:#ffffff;"><span>Total</span><span>₹${order.total.toLocaleString("en-IN")}</span></div>
        ${
          order.payment_type === "cod_advance"
            ? `<div style="display:flex;justify-content:space-between;margin-top:8px;color:#f5f5f5;"><span>Paid now</span><span>₹${(order.cod_advance_amount ?? 0).toLocaleString("en-IN")}</span></div>
               <div style="display:flex;justify-content:space-between;font-weight:bold;color:#e0b84a;"><span>Due on delivery</span><span>₹${(order.balance_due ?? 0).toLocaleString("en-IN")}</span></div>`
            : ""
        }
      </div>

      <div style="margin-top:24px;border-top:1px solid #333;padding-top:16px;text-align:center;">
        <p style="font-size:14px;color:#f5f5f5;">You earned <strong style="color:#e0b84a;">${milesEarned} Travaholic Miles</strong> on this order.</p>
      </div>

      <div style="margin-top:24px;font-size:13px;color:#aaa;">
        <p>Billed to: ${order.customer_name}</p>
        <p>Delivery address: ${fullAddress}</p>
      </div>
      ${referralSection}
      <div style="margin-top:24px;text-align:center;">
        <a href="${brand.siteUrl}" style="display:inline-block;padding:10px 24px;border:1px solid #f5f5f5;color:#f5f5f5;text-decoration:none;font-size:13px;letter-spacing:0.05em;text-transform:uppercase;">Visit ${brand.brandName} &amp; Shop More</a>
      </div>

      <div style="margin-top:24px;border-top:1px solid #333;padding-top:12px;font-size:12px;color:#777;">
        <p>Prices are inclusive of applicable GST.</p>
        <p style="margin-top:8px;">Travaholic · GSTIN 07BZNPS5735B2Z3</p>
        <p>C-152, Industrial Phase-1, Okhla, South Delhi, Delhi, 110020</p>
      </div>
    </div>
  `;
}
