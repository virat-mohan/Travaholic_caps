"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { chapterImageSrc } from "@/lib/chapters";
import { ease } from "@/lib/motion";
import type { Chapter } from "@/types/chapter";

export function SeriesCard({
  name,
  slug,
  blurb,
  representative,
  index = 0,
}: {
  name: string;
  slug: string;
  blurb: string;
  representative: Chapter;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: ease.premium, delay: (index % 2) * 0.12 }}
    >
      <Link href={`/series/${slug}`} className="group block">
        <div className="relative aspect-[4/5] overflow-hidden rounded-md bg-charcoal md:aspect-[3/4]">
          <Image
            src={chapterImageSrc(representative.folder, representative.primary)}
            alt={name}
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover grayscale-[0.15] contrast-[1.08] transition-transform duration-700 ease-out group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" />
          <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-8">
            <p className="font-display text-[2.6rem] uppercase leading-[0.92] text-white md:text-[3.4rem]">
              {name}
            </p>
            <p className="mt-3 max-w-[80%] text-body-s text-white/80">{blurb}</p>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
