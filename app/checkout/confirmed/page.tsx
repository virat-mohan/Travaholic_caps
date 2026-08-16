"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NewsletterBlock } from "@/components/newsletter/NewsletterBlock";
import { FooterEditorial } from "@/components/footer/FooterEditorial";

export default function OrderConfirmedPage() {
  const [referralCode, setReferralCode] = useState<string | null>(null);

  useEffect(() => {
    // Reads window.location directly rather than useSearchParams, which
    // forces a Suspense boundary on the page using it — same reasoning as
    // the attribution/referral capture in lib/client-tracking.ts.
    const orderId = new URLSearchParams(window.location.search).get("order");

    const lookup = orderId
      ? fetch(`/api/orders/${orderId}/referral-code`)
      : fetch("/api/account/me");

    lookup
      .then((res) => res.json())
      .then((data) => setReferralCode(data.referralCode ?? null))
      .catch(() => {});
  }, []);

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

        {referralCode && (
          <div className="mt-12 border border-divider p-6 text-left">
            <p className="text-caption uppercase tracking-[0.1em] text-secondary-text">
              Recommend to a Fellow Explorer
            </p>
            <p className="mt-2 text-body-s text-secondary-text">
              Share your code — they get a discount on their first order, you earn Miles once it
              ships.
            </p>
            <code className="mt-3 inline-block border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s tracking-[0.1em] text-ink">
              {referralCode}
            </code>
            <p className="mt-2">
              <Link href="/account" className="text-caption text-ink underline underline-offset-4">
                Send it from your account
              </Link>
            </p>
          </div>
        )}
      </main>

      <NewsletterBlock />
      <FooterEditorial />
    </>
  );
}
