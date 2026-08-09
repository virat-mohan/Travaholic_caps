"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { useDiscountRule } from "@/lib/useDiscountRule";
import { calculateDiscount } from "@/lib/discounts";
import { NewsletterBlock } from "@/components/newsletter/NewsletterBlock";
import { FooterEditorial } from "@/components/footer/FooterEditorial";

const WHATSAPP_NUMBER = "919958871283";

export default function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const discountRule = useDiscountRule();
  const discount = calculateDiscount(items, discountRule);
  const total = subtotal - discount;
  const router = useRouter();
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "" });
  const [isGift, setIsGift] = useState(false);
  const [giftNote, setGiftNote] = useState("");

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: form,
          items: items.map((i) => ({
            slug: i.slug,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
          })),
          subtotal,
          discountAmount: discount,
          total,
          isGift,
          giftNote: isGift ? giftNote : null,
        }),
      });
    } catch (err) {
      // Best-effort logging — WhatsApp remains the real order channel either way.
      console.error("Order logging failed", err);
    }

    const lines = [
      "New order from travaholic.in",
      "",
      ...items.map((i) => `${i.quantity} x ${i.name} — ₹${(i.price * i.quantity).toLocaleString("en-IN")}`),
      "",
      `Subtotal: ₹${subtotal.toLocaleString("en-IN")}`,
      ...(discount > 0 ? [`Discount: −₹${discount.toLocaleString("en-IN")}`] : []),
      `Total: ₹${total.toLocaleString("en-IN")}`,
      "",
      `Name: ${form.name}`,
      `Phone: ${form.phone}`,
      `Email: ${form.email}`,
      `Address: ${form.address}`,
      ...(isGift ? ["", "This is a gift.", `Gift note: ${giftNote || "(none)"}`] : []),
    ];

    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank");
    clear();
    router.push("/checkout/confirmed");
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto w-full max-w-[700px] px-6 pt-32 pb-24 text-center md:px-12 md:pt-40">
        <p className="font-display text-heading-l uppercase text-ink">Your Cart Is Empty.</p>
        <Link
          href="/series"
          className="mt-6 inline-block border border-ink px-8 py-3 font-sans text-body-s font-bold uppercase tracking-[0.1em] text-ink transition-colors duration-300 hover:bg-ink hover:text-cream"
        >
          Browse The Series
        </Link>
      </main>
    );
  }

  return (
    <>
      <main className="mx-auto w-full max-w-[700px] px-6 pt-32 pb-24 md:px-12 md:pt-40">
        <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">Checkout</p>
        <h1 className="mt-2 font-display text-heading-xl uppercase text-ink md:text-display-m">
          Almost Done.
        </h1>
        <p className="mt-4 max-w-md text-body-s text-secondary-text">
          We don&apos;t run this through a payment gateway yet — placing an order sends your
          details and cart straight to us on WhatsApp, and we&apos;ll confirm payment and delivery
          with you directly.
        </p>

        <div className="mt-10 space-y-2 border-y border-divider py-6">
          {items.map((item) => (
            <div key={item.slug} className="flex items-center justify-between text-body-s">
              <span className="text-ink">
                {item.quantity} × {item.name}
              </span>
              <span className="text-secondary-text">
                ₹{(item.price * item.quantity).toLocaleString("en-IN")}
              </span>
            </div>
          ))}
          {discount > 0 && discountRule && (
            <div className="flex items-center justify-between text-body-s">
              <span className="text-tan-gold">{discountRule.name}</span>
              <span className="text-tan-gold">−₹{discount.toLocaleString("en-IN")}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-3 font-display text-heading-s text-ink">
            <span>Total</span>
            <span>₹{total.toLocaleString("en-IN")}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-10 space-y-6">
          <div>
            <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
              Full Name
            </label>
            <input
              required
              value={form.name}
              onChange={update("name")}
              className="mt-3 w-full border border-ink/30 bg-surface px-5 py-3 font-sans text-body-s text-ink outline-none focus:border-ink"
            />
          </div>

          <div>
            <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
              Phone
            </label>
            <input
              required
              type="tel"
              value={form.phone}
              onChange={update("phone")}
              className="mt-3 w-full border border-ink/30 bg-surface px-5 py-3 font-sans text-body-s text-ink outline-none focus:border-ink"
            />
          </div>

          <div>
            <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
              Email
            </label>
            <input
              required
              type="email"
              value={form.email}
              onChange={update("email")}
              className="mt-3 w-full border border-ink/30 bg-surface px-5 py-3 font-sans text-body-s text-ink outline-none focus:border-ink"
            />
          </div>

          <div>
            <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
              Delivery Address
            </label>
            <textarea
              required
              rows={3}
              value={form.address}
              onChange={update("address")}
              className="mt-3 w-full border border-ink/30 bg-surface px-5 py-3 font-sans text-body-s text-ink outline-none focus:border-ink"
            />
          </div>

          <div className="border-t border-divider pt-6">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={isGift}
                onChange={(e) => setIsGift(e.target.checked)}
                className="h-4 w-4 accent-ink"
              />
              <span className="font-sans text-body-s uppercase tracking-[0.05em] text-ink">
                This is a gift
              </span>
            </label>

            {isGift && (
              <textarea
                rows={3}
                placeholder="Add a personal note to include with the order..."
                value={giftNote}
                onChange={(e) => setGiftNote(e.target.value)}
                className="mt-4 w-full border border-ink/30 bg-surface px-5 py-3 font-sans text-body-s text-ink outline-none placeholder:text-secondary-text focus:border-ink"
              />
            )}
          </div>

          <button
            type="submit"
            className="w-full border border-ink bg-ink px-8 py-4 font-sans text-body-s font-bold uppercase tracking-[0.1em] text-cream transition-colors duration-300 hover:bg-cream hover:text-ink"
          >
            Place Order via WhatsApp
          </button>
        </form>
      </main>

      <NewsletterBlock />
      <FooterEditorial />
    </>
  );
}
