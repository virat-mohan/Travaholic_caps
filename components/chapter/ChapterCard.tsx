"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import type { Chapter } from "@/types/chapter";
import { chapterImageSrc } from "@/lib/chapters";
import { ease } from "@/lib/motion";

export function ChapterCard({ chapter, index = 0 }: { chapter: Chapter; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: ease.premium, delay: (index % 4) * 0.08 }}
    >
      <Link href={`/chapter/${chapter.slug}`} className="group block">
        <div className="relative aspect-square overflow-hidden rounded-lg bg-surface-alt">
          <Image
            src={chapterImageSrc(chapter.folder, chapter.primary)}
            alt={chapter.name}
            fill
            sizes="(min-width: 1024px) 25vw, 50vw"
            className="object-cover object-bottom transition-transform duration-500 ease-out group-hover:scale-105"
          />
        </div>
        <div className="mt-3">
          <p className="text-body-s text-charcoal">{chapter.name}</p>
          <p className="text-caption text-secondary-text">{chapter.series}</p>
        </div>
      </Link>
    </motion.div>
  );
}
