import Link from "next/link";
import { NewsletterBlock } from "@/components/newsletter/NewsletterBlock";
import { FooterEditorial } from "@/components/footer/FooterEditorial";

export default function OrderConfirmedPage() {
  return (
    <>
      <main className="mx-auto w-full max-w-[600px] px-6 pt-32 pb-24 text-center md:px-12 md:pt-40">
        <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">
          Order Sent
        </p>
        <h1 className="mt-2 font-display text-heading-xl uppercase text-ink md:text-display-m">
          Check WhatsApp.
        </h1>
        <p className="mt-4 text-body text-secondary-text">
          Your order details opened in WhatsApp — send that message through and we&apos;ll
          confirm payment and delivery with you directly, usually within a few hours.
        </p>
        <Link
          href="/series"
          className="mt-8 inline-block border border-ink px-8 py-3 font-sans text-body-s font-bold uppercase tracking-[0.1em] text-ink transition-colors duration-300 hover:bg-ink hover:text-cream"
        >
          Keep Exploring
        </Link>
      </main>

      <NewsletterBlock />
      <FooterEditorial />
    </>
  );
}
