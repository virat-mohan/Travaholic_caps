"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, X } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useDiscountRule } from "@/lib/useDiscountRule";
import { calculateDiscount } from "@/lib/discounts";
import { NewsletterBlock } from "@/components/newsletter/NewsletterBlock";
import { FooterEditorial } from "@/components/footer/FooterEditorial";

export default function CartPage() {
  const { items, setQuantity, removeItem, subtotal } = useCart();
  const discountRule = useDiscountRule();
  const discount = calculateDiscount(items, discountRule);
  const total = subtotal - discount;

  return (
    <>
      <main className="mx-auto w-full max-w-[900px] px-6 pt-32 pb-24 md:px-12 md:pt-40">
        <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">Your Cart</p>
        <h1 className="mt-2 font-display text-heading-xl uppercase text-ink md:text-display-m">
          {items.length > 0 ? "Almost There." : "Empty, For Now."}
        </h1>

        {items.length === 0 ? (
          <div className="mt-16 border-t border-divider py-24 text-center">
            <p className="text-body text-secondary-text">
              Nothing in your cart yet — every Chapter starts somewhere.
            </p>
            <Link
              href="/series"
              className="mt-6 inline-block border border-ink px-8 py-3 font-sans text-body-s font-bold uppercase tracking-[0.1em] text-ink transition-colors duration-300 hover:bg-ink hover:text-cream"
            >
              Browse The Series
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-12 divide-y divide-divider border-y border-divider">
              {items.map((item) => (
                <div key={item.slug} className="flex items-center gap-5 py-6">
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden bg-surface-alt">
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      sizes="96px"
                      className="object-cover object-bottom"
                    />
                  </div>

                  <div className="flex-1">
                    <Link
                      href={`/chapter/${item.slug}`}
                      className="font-sans text-body-s uppercase tracking-[0.03em] text-ink hover:underline"
                    >
                      {item.name}
                    </Link>
                    <p className="mt-1 text-caption text-secondary-text">
                      ₹{item.price.toLocaleString("en-IN")}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 border border-divider px-3 py-1.5">
                    <button
                      aria-label="Decrease quantity"
                      onClick={() => setQuantity(item.slug, item.quantity - 1)}
                      className="text-ink"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-4 text-center text-body-s text-ink">{item.quantity}</span>
                    <button
                      aria-label="Increase quantity"
                      onClick={() => setQuantity(item.slug, item.quantity + 1)}
                      className="text-ink"
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  <p className="w-20 text-right font-sans text-body-s text-ink">
                    ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                  </p>

                  <button
                    aria-label="Remove"
                    onClick={() => removeItem(item.slug)}
                    className="text-secondary-text transition-colors hover:text-ink"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-8 flex items-center justify-between">
              <p className="font-sans text-body text-ink">Subtotal</p>
              <p className="font-sans text-body text-ink">₹{subtotal.toLocaleString("en-IN")}</p>
            </div>

            {discount > 0 && discountRule && (
              <div className="mt-2 flex items-center justify-between">
                <p className="font-sans text-body-s text-tan-gold">{discountRule.name}</p>
                <p className="font-sans text-body-s text-tan-gold">
                  −₹{discount.toLocaleString("en-IN")}
                </p>
              </div>
            )}

            <div className="mt-2 flex items-center justify-between border-t border-divider pt-3">
              <p className="font-sans text-body text-ink">Total</p>
              <p className="font-display text-heading-m text-ink">₹{total.toLocaleString("en-IN")}</p>
            </div>
            <p className="mt-2 text-caption text-secondary-text">
              Shipping and any taxes are calculated at checkout.
            </p>

            <Link
              href="/checkout"
              className="mt-8 block w-full border border-ink bg-ink px-8 py-4 text-center font-sans text-body-s font-bold uppercase tracking-[0.1em] text-cream transition-colors duration-300 hover:bg-cream hover:text-ink"
            >
              Proceed to Checkout
            </Link>
          </>
        )}
      </main>

      <NewsletterBlock />
      <FooterEditorial />
    </>
  );
}
