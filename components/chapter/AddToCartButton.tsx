"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import type { Chapter } from "@/types/chapter";

export function AddToCartButton({ chapter, image }: { chapter: Chapter; image: string }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  if (added) {
    return (
      <div className="flex items-center gap-4">
        <span className="font-sans text-body-s uppercase tracking-[0.05em] text-ink">
          Added to cart
        </span>
        <Link
          href="/cart"
          className="font-sans text-caption uppercase tracking-[0.1em] text-ink underline underline-offset-4"
        >
          View Cart
        </Link>
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        addItem(chapter, image);
        setAdded(true);
      }}
      className="border border-ink bg-ink px-8 py-3 font-sans text-body-s font-bold uppercase tracking-[0.1em] text-cream transition-colors duration-300 hover:bg-cream hover:text-ink"
    >
      Add to Cart
    </button>
  );
}
