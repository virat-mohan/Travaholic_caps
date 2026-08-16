import { getSetting } from "@/lib/settings";
import { renderInvoiceHtml } from "@/lib/invoice";
import { getBrandProfile } from "@/lib/brand";

type InvoiceOrder = Parameters<typeof renderInvoiceHtml>[0];
type InvoiceItem = Parameters<typeof renderInvoiceHtml>[1][number];

/**
 * Wraps a body fragment in a full HTML document forcing light-mode
 * rendering — without the explicit color-scheme meta tags, Apple/iOS Mail's
 * automatic dark-mode inversion flips black text/logos to white.
 */
function wrapEmailHtml(bodyHtml: string) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light only" />
</head>
<body style="background-color:#ffffff;margin:0;padding:24px 0;">
  ${bodyHtml}
</body>
</html>`;
}

/** Low-level Brevo send — every other function in this file (and lib/newsletter.ts) goes through this one. */
export async function sendEmail(to: string, subject: string, bodyHtml: string) {
  const apiKey = await getSetting("BREVO_API_KEY");
  if (!apiKey) {
    console.log(`BREVO_API_KEY not set — skipping email "${subject}" to ${to}`);
    return false;
  }

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "Travaholic", email: "orders@travaholic.in" },
        to: [{ email: to }],
        subject,
        htmlContent: wrapEmailHtml(bodyHtml),
      }),
    });
    if (!res.ok) {
      console.error("Brevo send failed", subject, res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("Brevo send failed", subject, err);
    return false;
  }
}

export async function sendInvoiceEmail(order: InvoiceOrder, items: InvoiceItem[]) {
  const invoiceHtml = await renderInvoiceHtml(order, items);
  await sendEmail(
    order.customer_email,
    `Your Travaholic Invoice — Order #${order.id.slice(0, 8).toUpperCase()}`,
    invoiceHtml
  );
}

/** Login OTP by email — the active channel while WhatsApp/SMS delivery is still being set up. */
export async function sendOtpEmail(email: string, code: string) {
  const brand = await getBrandProfile();
  const logoUrl = `${brand.siteUrl.replace(/\/$/, "")}/images/brand/travaholic-logo-email.png`;

  const html = `
    <div style="max-width:480px;margin:0 auto;background-color:#ffffff;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;text-align:center;">
      <div style="background-color:#ffffff;padding:16px 0;">
        <img src="${logoUrl}" alt="${brand.brandName}" width="100" style="display:inline-block;" />
      </div>
      <p style="font-size:14px;color:#666;">Your login code is</p>
      <p style="font-size:36px;font-weight:bold;letter-spacing:0.15em;margin:8px 0 24px;">${code}</p>
      <p style="font-size:13px;color:#999;">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
    </div>
  `;
  return sendEmail(email, `${code} is your ${brand.brandName} login code`, html);
}

type CartSessionForEmail = {
  customer_name: string | null;
  customer_email: string | null;
  items: { name: string; quantity: number }[];
};

/** Abandoned-cart nudge by email — mirrors sendAbandonedCartWhatsApp for customers without/before WhatsApp delivery. */
export async function sendAbandonedCartEmail(session: CartSessionForEmail) {
  if (!session.customer_email) return false;
  const brand = await getBrandProfile();
  const logoUrl = `${brand.siteUrl.replace(/\/$/, "")}/images/brand/travaholic-logo-email.png`;
  const cartUrl = `${brand.siteUrl.replace(/\/$/, "")}/cart`;
  const itemLines = session.items
    .map((i) => `<li style="margin-bottom:4px;">${i.quantity} × ${i.name}</li>`)
    .join("");

  const html = `
    <div style="max-width:480px;margin:0 auto;background-color:#ffffff;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;padding:0 24px;">
      <div style="background-color:#ffffff;padding:16px 0;text-align:center;">
        <img src="${logoUrl}" alt="${brand.brandName}" width="100" style="display:inline-block;" />
      </div>
      <p style="font-size:16px;">Hi ${session.customer_name ?? "there"},</p>
      <p style="font-size:14px;color:#444;line-height:1.6;">You left something in your cart:</p>
      <ul style="font-size:14px;color:#1a1a1a;list-style:none;margin:0;padding:0;">${itemLines}</ul>
      <a href="${cartUrl}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#101820;color:#f0eee4;text-decoration:none;text-transform:uppercase;letter-spacing:0.05em;font-size:13px;">Finish Checking Out</a>
      <p style="margin-top:32px;font-size:12px;color:#999;">${brand.brandName} · ${brand.siteUrl}</p>
    </div>
  `;
  return sendEmail(session.customer_email, `You left something at ${brand.brandName}`, html);
}

/** Sent once to each pending "notify me" lead when a sold-out Chapter's stock goes back above zero. */
export async function sendRestockEmail(email: string, name: string | null, chapterName: string, chapterSlug: string) {
  const brand = await getBrandProfile();
  const logoUrl = `${brand.siteUrl.replace(/\/$/, "")}/images/brand/travaholic-logo-email.png`;
  const chapterUrl = `${brand.siteUrl.replace(/\/$/, "")}/chapter/${chapterSlug}`;

  const html = `
    <div style="max-width:480px;margin:0 auto;background-color:#ffffff;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;padding:0 24px;">
      <div style="background-color:#ffffff;padding:16px 0;text-align:center;">
        <img src="${logoUrl}" alt="${brand.brandName}" width="100" style="display:inline-block;" />
      </div>
      <p style="font-size:16px;">Hi ${name ?? "there"},</p>
      <p style="font-size:14px;color:#444;line-height:1.6;">${chapterName} is back in stock — grab it before it sells out again.</p>
      <a href="${chapterUrl}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#101820;color:#f0eee4;text-decoration:none;text-transform:uppercase;letter-spacing:0.05em;font-size:13px;">Shop ${chapterName}</a>
      <p style="margin-top:32px;font-size:12px;color:#999;">${brand.brandName} · ${brand.siteUrl}</p>
    </div>
  `;
  return sendEmail(email, `${chapterName} is back in stock`, html);
}

/** Sent immediately when a customer invites a friend from their account page. */
export async function sendReferralInviteEmail(
  toEmail: string,
  toName: string | null,
  referrerName: string | null,
  referralCode: string,
  discountRupees: number
) {
  const brand = await getBrandProfile();
  const logoUrl = `${brand.siteUrl.replace(/\/$/, "")}/images/brand/travaholic-logo-email.png`;
  const referralUrl = `${brand.siteUrl.replace(/\/$/, "")}/?ref=${referralCode}`;

  const html = `
    <div style="max-width:480px;margin:0 auto;background-color:#ffffff;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;padding:0 24px;">
      <div style="background-color:#ffffff;padding:16px 0;text-align:center;">
        <img src="${logoUrl}" alt="${brand.brandName}" width="100" style="display:inline-block;" />
      </div>
      <p style="font-size:16px;">Hi ${toName ?? "there"},</p>
      <p style="font-size:14px;color:#444;line-height:1.6;">
        ${referrerName ?? "A friend"} thinks you&apos;d like ${brand.brandName} — travel-inspired trucker
        caps, ₹1,399 flat. Use their link and get ₹${discountRupees} off your first order.
      </p>
      <a href="${referralUrl}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#101820;color:#f0eee4;text-decoration:none;text-transform:uppercase;letter-spacing:0.05em;font-size:13px;">Shop &amp; Save ₹${discountRupees}</a>
      <p style="margin-top:32px;font-size:12px;color:#999;">${brand.brandName} · ${brand.siteUrl}</p>
    </div>
  `;
  return sendEmail(toEmail, `${referrerName ?? "A friend"} gave you ₹${discountRupees} off ${brand.brandName}`, html);
}

/** Sent once, when an order's shipment status transitions to delivered — see the courier-status webhook. */
export async function sendReviewRequestEmail(
  toEmail: string,
  customerName: string | null,
  orderId: string,
  chapterNames: string[]
) {
  const brand = await getBrandProfile();
  const logoUrl = `${brand.siteUrl.replace(/\/$/, "")}/images/brand/travaholic-logo-email.png`;
  const reviewUrl = `${brand.siteUrl.replace(/\/$/, "")}/review/${orderId}`;
  const itemsLine = chapterNames.join(", ");

  const html = `
    <div style="max-width:480px;margin:0 auto;background-color:#ffffff;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;padding:0 24px;">
      <div style="background-color:#ffffff;padding:16px 0;text-align:center;">
        <img src="${logoUrl}" alt="${brand.brandName}" width="100" style="display:inline-block;" />
      </div>
      <p style="font-size:16px;">Hi ${customerName ?? "there"},</p>
      <p style="font-size:14px;color:#444;line-height:1.6;">
        Your ${itemsLine} should have arrived by now — how is it? A quick review helps other
        travellers pick the right Chapter, and takes under a minute.
      </p>
      <a href="${reviewUrl}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#101820;color:#f0eee4;text-decoration:none;text-transform:uppercase;letter-spacing:0.05em;font-size:13px;">Leave a Review</a>
      <p style="margin-top:32px;font-size:12px;color:#999;">${brand.brandName} · ${brand.siteUrl}</p>
    </div>
  `;
  return sendEmail(toEmail, `How's your ${brand.brandName}?`, html);
}

/** Retention nudge for a customer who hasn't ordered in a while — see the win-back cron. */
export async function sendWinbackEmail(toEmail: string, name: string | null, milesBalance: number) {
  const brand = await getBrandProfile();
  const logoUrl = `${brand.siteUrl.replace(/\/$/, "")}/images/brand/travaholic-logo-email.png`;
  const shopUrl = `${brand.siteUrl.replace(/\/$/, "")}/series`;

  const milesLine =
    milesBalance > 0
      ? `You've still got ${milesBalance.toLocaleString("en-IN")} Travaholic Miles sitting there, ready to redeem.`
      : "There are new Chapters up since you last checked in.";

  const html = `
    <div style="max-width:480px;margin:0 auto;background-color:#ffffff;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;padding:0 24px;">
      <div style="background-color:#ffffff;padding:16px 0;text-align:center;">
        <img src="${logoUrl}" alt="${brand.brandName}" width="100" style="display:inline-block;" />
      </div>
      <p style="font-size:16px;">Hi ${name ?? "there"},</p>
      <p style="font-size:14px;color:#444;line-height:1.6;">It's been a while — ${milesLine}</p>
      <a href="${shopUrl}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#101820;color:#f0eee4;text-decoration:none;text-transform:uppercase;letter-spacing:0.05em;font-size:13px;">Shop the Collection</a>
      <p style="margin-top:32px;font-size:12px;color:#999;">${brand.brandName} · ${brand.siteUrl}</p>
    </div>
  `;
  return sendEmail(toEmail, `We miss you at ${brand.brandName}`, html);
}
