import { renderInvoiceHtml } from "@/lib/invoice";

const sampleOrder = {
  id: "a1b2c3d4-preview",
  created_at: new Date().toISOString(),
  customer_name: "Aarav Mehta",
  customer_email: "aarav@example.com",
  delivery_address: "42, Green Park Extension, New Delhi, 110016",
  subtotal: 4197,
  discount_amount: 700,
  total: 3497,
};

const sampleItems = [
  { chapter_name: "Travaholic Orange", unit_price: 1399, quantity: 1 },
  { chapter_name: "Dunes Maroon", unit_price: 1399, quantity: 1 },
  { chapter_name: "Wildling", unit_price: 1399, quantity: 1 },
];

export default async function InvoicePreviewPage() {
  const html = await renderInvoiceHtml(sampleOrder, sampleItems);

  return (
    <main className="mx-auto w-full max-w-[900px] px-6 pt-28 pb-24 md:px-12">
      <h1 className="mt-2 font-display text-heading-l uppercase text-ink">Invoice Email Preview</h1>
      <p className="mt-2 max-w-lg text-body-s text-secondary-text">
        This is exactly the HTML that gets emailed via Brevo after an order is placed — shown here
        with sample data since no paid orders exist yet.
      </p>
      <div className="mt-10 border border-divider bg-white p-8">
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>

      <h2 className="mt-16 font-display text-heading-l uppercase text-ink">
        WhatsApp Order Card
      </h2>
      <p className="mt-2 max-w-lg text-body-s text-secondary-text">
        The header image attached to the order-confirmation WhatsApp template — WhatsApp
        doesn&apos;t render HTML, so this image plus the template&apos;s plain-text body is the
        closest equivalent to a designed confirmation.
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/api/og/order-confirmation/sample"
        alt="Sample WhatsApp order confirmation card"
        width={400}
        height={400}
        className="mt-6 border border-divider"
      />
    </main>
  );
}
