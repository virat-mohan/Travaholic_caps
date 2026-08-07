"use client";

import Image from "next/image";
import { useState } from "react";
import { chapterImageSrc } from "@/lib/chapters";

export function ChapterGallery({ folder, images, name }: { folder: string; images: string[]; name: string }) {
  const [active, setActive] = useState(0);

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-lg bg-surface-alt">
        <Image
          src={chapterImageSrc(folder, images[active])}
          alt={name}
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
          priority
        />
      </div>
      <div className="mt-4 grid grid-cols-5 gap-3">
        {images.map((img, i) => (
          <button
            key={img}
            onClick={() => setActive(i)}
            className={`relative aspect-square overflow-hidden rounded-sm bg-surface-alt transition-opacity ${
              i === active ? "opacity-100 ring-1 ring-charcoal" : "opacity-70 hover:opacity-100"
            }`}
            aria-label={`${name} view ${i + 1}`}
          >
            <Image
              src={chapterImageSrc(folder, img)}
              alt=""
              fill
              sizes="120px"
              className="object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
