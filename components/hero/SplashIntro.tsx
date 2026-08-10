"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const GRID_SIZE = 4; // 4x4 = 16 cells, one per Chapter, no empty center needed
const CELL_COUNT = GRID_SIZE * GRID_SIZE;
const SWEEP_MS = 2600;
const MAX_DIAGONAL = (GRID_SIZE - 1) * 2;
const CELL_TRANSITION_MS = 1300;
const HOLD_MS = 8000;
const EXIT_MS = 700;
const SESSION_KEY = "travaholic-splash-shown";

const CELLS = Array.from({ length: CELL_COUNT }, (_, i) => `/splash-thumbs/cell-${i + 1}.webp`);

export function SplashIntro() {
  const pathname = usePathname();
  const [shouldRender, setShouldRender] = useState(false);
  const [visible, setVisible] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [exiting, setExiting] = useState(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialized = useRef(false);

  useLayoutEffect(() => {
    if (pathname !== "/" || sessionStorage.getItem(SESSION_KEY)) {
      document.documentElement.classList.remove("splash-pending");
      return;
    }
    if (initialized.current) return; // guards React Strict Mode's dev double-invocation

    initialized.current = true;
    sessionStorage.setItem(SESSION_KEY, "1");
    setShouldRender(true);
    document.documentElement.classList.remove("splash-pending");

    let settled = 0;

    const onSettle = () => {
      settled += 1;
      if (settled === CELL_COUNT) {
        setRevealed(true);
        const totalRevealMs = MAX_DIAGONAL * (SWEEP_MS / MAX_DIAGONAL) + CELL_TRANSITION_MS;
        exitTimer.current = setTimeout(triggerExit, totalRevealMs + HOLD_MS);
      }
    };

    CELLS.forEach((src) => {
      const img = new window.Image();
      img.onload = onSettle;
      img.onerror = onSettle;
      img.src = src;
    });

    return () => {
      if (exitTimer.current) clearTimeout(exitTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function triggerExit() {
    if (exitTimer.current) clearTimeout(exitTimer.current);
    setExiting(true);
    setTimeout(() => setVisible(false), EXIT_MS);
  }

  if (!shouldRender || !visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 1, scale: 1 }}
        animate={exiting ? { opacity: 0, scale: 1.05 } : { opacity: 1, scale: 1 }}
        transition={{ duration: EXIT_MS / 1000, ease: [0.16, 1, 0.3, 1] }}
        onClick={triggerExit}
        className="fixed inset-0 z-[999] flex cursor-pointer flex-col items-center justify-center overflow-y-auto bg-black py-6"
      >
        <div className="relative aspect-square h-[70vmin] w-[70vmin] max-h-[820px] max-w-[820px] shrink-0 md:h-[76vmin] md:w-[76vmin] md:max-h-[880px] md:max-w-[880px]">
          <div className="grid h-full w-full grid-cols-4 grid-rows-4 gap-[8px] md:gap-[14px]">
            {CELLS.map((src, i) => {
              const row = Math.floor(i / GRID_SIZE);
              const col = i % GRID_SIZE;
              const delayMs = (row + col) * (SWEEP_MS / MAX_DIAGONAL);
              return (
                <div key={src} className="relative overflow-hidden bg-black">
                  <Image
                    src={src}
                    alt=""
                    fill
                    sizes="(min-width: 960px) 240px, 25vw"
                    className="object-cover"
                    style={{
                      opacity: revealed ? 1 : 0,
                      transform: revealed ? "scale(1)" : "scale(1.2)",
                      transition: `opacity ${CELL_TRANSITION_MS}ms ease-out, transform ${CELL_TRANSITION_MS}ms ease-out`,
                      transitionDelay: `${delayMs}ms`,
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: revealed ? 1 : 0 }}
          transition={{ duration: 0.6, delay: revealed ? 0.5 : 0 }}
          className="mt-6 flex flex-col items-center gap-2 text-center"
        >
          <Image
            src="/images/brand/travaholic-logo-mono-white.png"
            alt="Travaholic"
            width={132}
            height={95}
            className="h-auto w-[90px]"
          />
          <p className="font-display text-body-l uppercase tracking-[0.1em] text-white">
            Travel Inspired Truckers
          </p>
          <p className="-mt-1 font-display text-caption uppercase tracking-[0.25em] text-white/80">
            Made In India
          </p>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: revealed ? 1 : 0 }}
          transition={{ duration: 0.5, delay: revealed ? 1 : 0 }}
          className="fixed bottom-6 right-6 font-sans text-micro uppercase tracking-[0.15em] text-cream/60"
        >
          Skip
        </motion.p>
      </motion.div>
    </AnimatePresence>
  );
}
