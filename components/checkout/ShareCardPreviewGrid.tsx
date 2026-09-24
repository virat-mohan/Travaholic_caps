"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { buildShareCard } from "@/components/checkout/ShareToInstagramButton";
import type { ShareCardProduct } from "@/lib/share-card-pool";

// Mirrors THEME_WORDS in lib/post-barter.ts — kept in step by hand since
// that module is server-only and this grid runs in the browser.
const THEME_WORDS = ["WANDERLUST", "HORIZON", "OPENROAD", "NEWCHAPTER", "PASSPORT", "WAYFARER", "SKYWARD", "TRAILBLAZER", "GOODVIBES", "NOMAD"];

export function ShareCardPreviewGrid({ pool, siteUrl, firstName }: { pool: ShareCardProduct[]; siteUrl: string; firstName: string }) {
  const [cards, setCards] = useState<{ code: string; product: string; url: string }[]>([]);
  const siteDomain = siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const base = firstName.replace(/[^a-zA-Z0-9]/g, "").toUpperCase() || "TRAVELER";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const out: { code: string; product: string; url: string }[] = [];
      for (let i = 0; i < pool.length; i++) {
        const code = `${base}${THEME_WORDS[i % THEME_WORDS.length]}`;
        const blob = await buildShareCard(code, siteDomain, pool[i].imageUrl, pool[i].productName);
        if (cancelled) return;
        if (blob) out.push({ code, product: pool[i].productName, url: URL.createObjectURL(blob) });
        setCards([...out]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pool, siteDomain, base]);

  return (
    <div className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-4">
      {cards.map((c) => (
        <figure key={c.code + c.product}>
          <div className="relative aspect-[4/5] w-full overflow-hidden border border-ink/20 bg-surface-alt">
            <Image src={c.url} alt={`${c.product} — ${c.code}`} fill unoptimized className="object-cover" />
          </div>
          <figcaption className="mt-2 text-caption text-secondary-text">
            {c.product} · <span className="font-bold text-ink">{c.code}</span>
          </figcaption>
        </figure>
      ))}
      {cards.length === 0 && <p className="col-span-full text-body-s text-secondary-text">Rendering cards…</p>}
    </div>
  );
}
