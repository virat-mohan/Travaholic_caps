"use client";

import type { ReactElement } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { seriesOrder } from "@/lib/series";
import {
  SunsetGlyph,
  WildlingGlyph,
  HorizonGlyph,
  SkylineGlyph,
  PeakingGlyph,
  DunesGlyph,
} from "@/components/globe/TerrainGlyph";

const GLYPHS: Record<string, (props: { className?: string }) => ReactElement> = {
  "Summer Escape": SunsetGlyph,
  "Into The Wild": WildlingGlyph,
  "Blue Horizon": HorizonGlyph,
  "Urban Nomad": SkylineGlyph,
  "Above The Clouds": PeakingGlyph,
  "Desert Trails": DunesGlyph,
};

// Rough equirectangular placements (x%, y%) for each terrain's real-world home.
const PIN_POSITION: Record<string, { x: number; y: number }> = {
  "Urban Nomad": { x: 29, y: 27 }, // New York
  "Blue Horizon": { x: 8, y: 39 }, // Pacific
  "Summer Escape": { x: 82, y: 54 }, // Bali
  "Into The Wild": { x: 33, y: 53 }, // Amazon
  "Above The Clouds": { x: 74, y: 34 }, // Himalayas
  "Desert Trails": { x: 53, y: 37 }, // Sahara
};

export function ExploreGlobe() {
  return (
    <section id="pick-your-world" className="scroll-mt-24 py-24 md:py-30">
      <div className="mx-auto max-w-[560px] text-center">
        <p className="text-caption uppercase tracking-[0.08em] text-secondary-text">
          Explore by Terrain
        </p>
        <p className="mt-3 font-display text-heading-l text-charcoal md:text-heading-xl">
          Pick your world.
        </p>
      </div>

      <div
        className="relative mx-auto mt-14 w-full max-w-[900px] overflow-hidden rounded-lg shadow-[0_20px_60px_-20px_rgba(0,0,0,0.35)]"
        style={{ aspectRatio: "4 / 3", backgroundColor: "#ddc9a3" }}
      >
        {/* parchment grain */}
        <div
          className="absolute inset-0 opacity-[0.18] mix-blend-multiply"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(90,66,38,0.35) 100%)",
          }}
        />

        <Image
          src="/images/globe/world-map-clay.png"
          alt="World map"
          fill
          sizes="(min-width: 900px) 900px, 100vw"
          className="object-contain p-6"
        />

        {seriesOrder.map((s, i) => {
          const pos = PIN_POSITION[s.name] ?? { x: 50, y: 50 };
          const Glyph = GLYPHS[s.name] ?? SunsetGlyph;

          return (
            <motion.div
              key={s.slug}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 4 + i, repeat: Infinity, ease: "easeInOut" }}
            >
              <Link href={`/series/${s.slug}`} className="group flex flex-col items-center gap-1.5">
                <span
                  className="relative block h-12 w-12 overflow-hidden rounded-[10px] transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-0.5 md:h-14 md:w-14"
                  style={{
                    boxShadow:
                      "0 10px 16px -6px rgba(40,28,12,0.45), 0 2px 4px rgba(40,28,12,0.25)",
                  }}
                >
                  <Glyph className="h-full w-full" />
                </span>
                <span
                  className="absolute left-1/2 top-full h-2 w-6 -translate-x-1/2 rounded-full opacity-40 blur-[3px]"
                  style={{ background: "radial-gradient(closest-side, rgba(0,0,0,0.6), transparent)" }}
                />
                <span className="whitespace-nowrap rounded-pill bg-charcoal/90 px-2.5 py-1 text-micro text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  {s.name}
                </span>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
