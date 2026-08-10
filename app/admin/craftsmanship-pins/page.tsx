"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { chapters } from "@/lib/chapters";
import { CRAFTSMANSHIP_LABELS } from "@/lib/craftsmanshipPins";

type Coord = { x: number; y: number };
type ChapterCoords = Record<string, Coord>;

const LABELS = [...CRAFTSMANSHIP_LABELS];

const STORAGE_KEY = "travaholic-craftsmanship-calibration";

export default function CraftsmanshipCalibrationPage() {
  const [chapterSlug, setChapterSlug] = useState(chapters[0].slug);
  const [labelIndex, setLabelIndex] = useState(0);
  const [allCoords, setAllCoords] = useState<Record<string, ChapterCoords>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setAllCoords(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allCoords));
  }, [allCoords]);

  const coords = allCoords[chapterSlug] ?? {};

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round((((e.clientX - rect.left) / rect.width) * 100) * 100) / 100;
    const y = Math.round((((e.clientY - rect.top) / rect.height) * 100) * 100) / 100;

    setAllCoords((prev) => ({
      ...prev,
      [chapterSlug]: { ...prev[chapterSlug], [LABELS[labelIndex]]: { x, y } },
    }));

    if (labelIndex < LABELS.length - 1) setLabelIndex(labelIndex + 1);
  }

  const doneForChapter = Object.keys(coords).length;
  const jsonOutput = JSON.stringify(allCoords, null, 2);

  return (
    <main className="mx-auto w-full max-w-[1400px] px-6 pt-28 pb-24 md:px-12">
      <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">
        Internal — not linked in navigation
      </p>
      <h1 className="mt-2 font-display text-heading-l uppercase text-ink">
        Craftsmanship Pin Calibration
      </h1>
      <p className="mt-2 max-w-lg text-body-s text-secondary-text">
        Pick a chapter, then click where each feature actually is on that cap. Auto-advances
        through the 6 labels. Switch chapters any time — each one gets its own set of 6 points.
        Copy the JSON at the bottom when you&apos;re done and send it back.
      </p>

      <div className="mt-8 flex flex-wrap gap-2">
        {chapters.map((c) => (
          <button
            key={c.slug}
            onClick={() => {
              setChapterSlug(c.slug);
              setLabelIndex(0);
            }}
            className={`border px-3 py-1.5 text-caption uppercase tracking-[0.05em] ${
              chapterSlug === c.slug
                ? "border-ink bg-ink text-cream"
                : allCoords[c.slug] && Object.keys(allCoords[c.slug]).length === LABELS.length
                  ? "border-divider bg-surface-alt text-ink"
                  : "border-divider text-secondary-text"
            }`}
          >
            {c.name} {allCoords[c.slug] ? `(${Object.keys(allCoords[c.slug]).length}/6)` : ""}
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {LABELS.map((label, i) => (
          <button
            key={label}
            onClick={() => setLabelIndex(i)}
            className={`border px-3 py-1.5 text-caption uppercase tracking-[0.03em] ${
              labelIndex === i
                ? "border-ink bg-ink text-cream"
                : coords[label]
                  ? "border-divider bg-surface-alt text-ink"
                  : "border-divider text-secondary-text"
            }`}
          >
            {label} {coords[label] ? "✓" : ""}
          </button>
        ))}
      </div>

      <p className="mt-4 text-caption text-secondary-text">
        {doneForChapter} / {LABELS.length} placed for{" "}
        <span className="font-bold text-ink">
          {chapters.find((c) => c.slug === chapterSlug)?.name}
        </span>{" "}
        — now clicking:{" "}
        <span className="font-bold text-ink">{LABELS[labelIndex]}</span>
      </p>

      <div
        onClick={handleClick}
        className="relative mt-6 h-[500px] w-full max-w-[700px] cursor-crosshair bg-surface-alt"
      >
        <Image
          src={`/images/craftsmanship/${chapterSlug}.png`}
          alt={chapterSlug}
          fill
          sizes="700px"
          className="object-contain"
        />
        {Object.entries(coords).map(([label, c]) => (
          <div
            key={label}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-red-600"
            style={{ left: `${c.x}%`, top: `${c.y}%`, width: 10, height: 10 }}
            title={label}
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
          rows={16}
          className="w-full max-w-[700px] border border-divider bg-surface p-4 font-mono text-caption text-ink"
        />
      </div>
    </main>
  );
}
