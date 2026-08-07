"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ease } from "@/lib/motion";

type HeroFullProps = {
  imageSrc: string;
  headline: string;
  supportingCopy: string;
  primaryCta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
};

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.12, delayChildren: 0.3 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: ease.premium },
  },
};

export function HeroFull({
  imageSrc,
  headline,
  supportingCopy,
  primaryCta,
  secondaryCta,
}: HeroFullProps) {
  return (
    <section className="relative flex min-h-[92vh] items-start overflow-hidden bg-charcoal">
      <motion.div
        initial={{ scale: 1.08 }}
        animate={{ scale: 1 }}
        transition={{ duration: 2.2, ease: ease.premium }}
        className="absolute inset-0"
      >
        <Image src={imageSrc} alt="" fill priority sizes="100vw" className="object-cover" />
      </motion.div>
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/10 to-transparent" />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 max-w-[760px] px-6 pt-36 md:px-16 md:pt-44"
      >
        <motion.h1
          variants={item}
          className="font-display text-display-m text-white md:text-display-xl"
        >
          {headline}
        </motion.h1>
        <motion.p variants={item} className="mt-4 max-w-md text-body text-white/85">
          {supportingCopy}
        </motion.p>
        <motion.div variants={item} className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href={primaryCta.href}
            className="rounded-pill bg-white px-6 py-3 text-body-s text-charcoal transition-transform duration-300 ease-out hover:scale-[1.02]"
          >
            {primaryCta.label}
          </Link>
          {secondaryCta && (
            <Link
              href={secondaryCta.href}
              className="rounded-pill border border-white/60 px-6 py-3 text-body-s text-white transition-colors duration-300 hover:bg-white/10"
            >
              {secondaryCta.label}
            </Link>
          )}
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1, duration: 0.6 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-micro uppercase tracking-[0.2em] text-white/70"
      >
        Scroll to Explore
      </motion.div>
    </section>
  );
}
