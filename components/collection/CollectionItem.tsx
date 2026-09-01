"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus } from "lucide-react";
import type { Chapter } from "@/types/chapter";
import { chapterImageSrc } from "@/lib/chapters";
import { AddToCartButton } from "@/components/chapter/AddToCartButton";
import { BuyNowButton } from "@/components/chapter/BuyNowButton";
import type { StockLabel } from "@/lib/inventory";

export function CollectionItem({
  chapter,
  stockLabel = null,
}: {
  chapter: Chapter;
  stockLabel?: StockLabel;
}) {
  const [quantity, setQuantity] = useState(1);
  const image = chapterImageSrc(chapter.folder, chapter.sideImage);
  const disabled = stockLabel === "out-of-stock";

  return (
    <div className="flex flex-col">
      <Link href={`/chapter/${chapter.slug}`} className="group block">
        <div className="chapter-card-bg relative aspect-square overflow-hidden rounded-lg bg-surface-alt">
          <Image
            src={image}
            alt={chapter.name}
            fill
            sizes="(min-width: 1024px) 22vw, 45vw"
            className="object-cover object-bottom transition-transform duration-500 ease-out group-hover:scale-105"
          />
          {stockLabel && (
            <span
              className={`absolute left-2 top-2 px-2 py-1 text-micro font-bold uppercase tracking-[0.05em] ${
                stockLabel === "out-of-stock" ? "bg-ink text-cream" : "bg-tan-gold text-ink"
              }`}
            >
              {stockLabel === "out-of-stock" ? "Sold Out" : "Selling Fast"}
            </span>
          )}
        </div>
        <p className="mt-3 line-clamp-2 min-h-[2lh] font-sans text-body-s uppercase tracking-[0.03em] text-ink">
          {chapter.name}
        </p>
      </Link>
      <p className="mt-1 line-clamp-2 min-h-[2lh] text-caption text-secondary-text">{chapter.story}</p>
      <p className="mt-2 font-sans text-body-s text-ink">₹{chapter.price.toLocaleString("en-IN")}</p>

      {/* Kept in the layout (just hidden) rather than unmounted when sold
          out, so every card in the row reserves the same height and the
          Add to Cart / Sold Out buttons below all land on the same line. */}
      <div className={`mt-3 flex items-center gap-2 ${disabled ? "invisible" : ""}`}>
        <button
          type="button"
          aria-label="Decrease quantity"
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          className="flex h-8 w-8 items-center justify-center border border-ink/30 text-ink hover:border-ink"
        >
          <Minus size={14} />
        </button>
        <span className="w-6 text-center font-sans text-body-s text-ink">{quantity}</span>
        <button
          type="button"
          aria-label="Increase quantity"
          onClick={() => setQuantity((q) => q + 1)}
          className="flex h-8 w-8 items-center justify-center border border-ink/30 text-ink hover:border-ink"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-2 [&>button]:w-full [&>div>button]:w-full">
        <AddToCartButton chapter={chapter} image={image} disabled={disabled} quantity={quantity} />
        <BuyNowButton chapter={chapter} image={image} disabled={disabled} quantity={quantity} />
      </div>
    </div>
  );
}
