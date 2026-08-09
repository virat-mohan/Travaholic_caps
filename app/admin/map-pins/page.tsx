"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { chapters } from "@/lib/chapters";

type Coord = { x: number; y: number };

const STORAGE_KEY = "travaholic-map-pin-calibration";

export default function MapPinCalibrationPage() {
  const [selectedSlug, setSelectedSlug] = useState(chapters[0].slug);
  const [coords, setCoords] = useState<Record<string, Coord>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setCoords(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(coords));
  }, [coords]);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setCoords((prev) => ({ ...prev, [selectedSlug]: { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 } }));

    // auto-advance to the next chapter that doesn't have a pin yet
    const next = chapters.find((c) => c.slug !== selectedSlug && !coords[c.slug]);
    if (next) setSelectedSlug(next.slug);
  }

  const doneCount = Object.keys(coords).length;
  const jsonOutput = JSON.stringify(coords, null, 2);

  return (
    <main className="mx-auto w-full max-w-[1400px] px-6 pt-28 pb-24 md:px-12">
      <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">
        Internal — not linked in navigation
      </p>
      <h1 className="mt-2 font-display text-heading-l uppercase text-ink">Map Pin Calibration</h1>
      <p className="mt-2 max-w-lg text-body-s text-secondary-text">
        Pick a chapter below, then click its real-world spot on the map. It auto-advances to the
        next unplaced chapter. When you're done, copy the JSON at the bottom and send it back.
      </p>

      <div className="mt-8 flex flex-wrap gap-2">
        {chapters.map((c) => (
          <button
            key={c.slug}
            onClick={() => setSelectedSlug(c.slug)}
            className={`border px-3 py-1.5 text-caption uppercase tracking-[0.05em] ${
              selectedSlug === c.slug
                ? "border-ink bg-ink text-cream"
                : coords[c.slug]
                  ? "border-divider bg-surface-alt text-ink"
                  : "border-divider text-secondary-text"
            }`}
          >
            {c.name} {coords[c.slug] ? "✓" : ""}
          </button>
        ))}
      </div>

      <p className="mt-4 text-caption text-secondary-text">
        {doneCount} / {chapters.length} placed — now selecting:{" "}
        <span className="font-bold text-ink">
          {chapters.find((c) => c.slug === selectedSlug)?.name}
        </span>
      </p>

      <div
        onClick={handleClick}
        className="relative mt-6 w-full max-w-[1100px] cursor-crosshair"
        style={{ aspectRatio: "4928 / 3712" }}
      >
        <Image
          src="/images/globe/world-map-clay.png"
          alt="World map"
          fill
          sizes="1100px"
          className="object-contain"
        />
        {Object.entries(coords).map(([slug, c]) => (
          <div
            key={slug}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-red-600"
            style={{ left: `${c.x}%`, top: `${c.y}%`, width: 10, height: 10 }}
            title={chapters.find((ch) => ch.slug === slug)?.name}
          />
        ))}
      </div>

      <div className="mt-10">
        <p className="mb-2 text-caption uppercase tracking-[0.1em] text-secondary-text">
          JSON (copy and send this back)
        </p>
        <textarea
          readOnly
          value={jsonOutput}
          rows={12}
          className="w-full max-w-[600px] border border-divider bg-surface p-4 font-mono text-caption text-ink"
        />
      </div>
    </main>
  );
}
