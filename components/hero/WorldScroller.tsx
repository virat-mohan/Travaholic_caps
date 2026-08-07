"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { chapterImageSrc } from "@/lib/chapters";
import { seriesOrder, seriesChapters } from "@/lib/series";

export function WorldScroller() {
  const tiles = seriesOrder
    .map((s) => ({ series: s, rep: seriesChapters(s.name)[0] }))
    .filter((t) => t.rep);

  return (
    <section className="relative overflow-hidden bg-charcoal pt-28 pb-10 md:pt-36">
      <svg width="0" height="0" className="absolute">
        <filter id="worldPaint" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.01 0.018" numOctaves="2" seed="4" result="turb" />
          <feDisplacementMap in="SourceGraphic" in2="turb" scale="18" xChannelSelector="R" yChannelSelector="G" />
          <feColorMatrix
            type="matrix"
            values="1.25 0 0 0 0
                    0 1.1 0 0 0
                    0 0 0.9 0 0
                    0 0 0 1 0"
          />
        </filter>
      </svg>

      <div className="px-6 md:px-16">
        <p className="text-caption uppercase tracking-[0.08em] text-white/60">
          Stories You Can Wear
        </p>
        <h1 className="mt-2 font-display text-[3.4rem] uppercase leading-[0.9] text-white md:text-[6rem]">
          Pick your world.
        </h1>
      </div>

      <div className="mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-4 md:px-16 [&::-webkit-scrollbar]:hidden">
        {tiles.map(({ series, rep }, i) => (
          <motion.div
            key={series.slug}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 + i * 0.08 }}
            className="relative w-[72vw] shrink-0 snap-start overflow-hidden rounded-md md:w-[360px]"
          >
            <Link href={`/series/${series.slug}`} className="group block">
              <div className="relative aspect-[3/4]" style={{ backgroundColor: "var(--color-parchment)" }}>
                <Image
                  src={chapterImageSrc(rep!.folder, rep!.primary)}
                  alt={series.name}
                  fill
                  sizes="360px"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  style={{ filter: "url(#worldPaint) saturate(1.4) contrast(1.1)" }}
                />
                <div
                  className="absolute inset-0 mix-blend-multiply opacity-25"
                  style={{ backgroundColor: "var(--color-parchment)" }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <p className="font-display text-heading-m uppercase text-white">{series.name}</p>
                  <p className="mt-1 text-caption text-white/75">{series.blurb}</p>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
