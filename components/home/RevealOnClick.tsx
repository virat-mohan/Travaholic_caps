"use client";

import { useState, type ReactNode } from "react";

export function RevealOnClick({ children }: { children: ReactNode }) {
  const [revealed, setRevealed] = useState(false);

  if (!revealed) {
    return (
      <div className="flex justify-center pb-24 pt-2">
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="border-2 border-ink px-10 py-4 font-sans text-body-s font-bold uppercase tracking-[0.12em] text-ink transition-colors duration-300 hover:bg-ink hover:text-cream"
        >
          Explore The Collection
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
