"use client";

import { useMemo, useState } from "react";
import { CollectionItem } from "@/components/collection/CollectionItem";
import type { Chapter, StorySeries } from "@/types/chapter";
import type { StockLabel } from "@/lib/inventory";

export function CollectionGrid({
  collection,
  seriesPresent,
  stockLabels,
}: {
  collection: Chapter[];
  seriesPresent: StorySeries[];
  stockLabels: Record<string, StockLabel>;
}) {
  const [activeSeries, setActiveSeries] = useState<StorySeries | "all">("all");

  const filtered = useMemo(
    () => (activeSeries === "all" ? collection : collection.filter((c) => c.series === activeSeries)),
    [collection, activeSeries]
  );

  return (
    <>
      {seriesPresent.length > 1 && (
        <div className="mt-6 flex flex-wrap gap-2 md:mt-8">
          <button
            type="button"
            onClick={() => setActiveSeries("all")}
            className={`border px-4 py-2 font-sans text-caption uppercase tracking-[0.05em] transition-colors ${
              activeSeries === "all"
                ? "border-ink bg-ink text-cream"
                : "border-ink/30 text-ink hover:border-ink"
            }`}
          >
            All
          </button>
          {seriesPresent.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setActiveSeries(s)}
              className={`border px-4 py-2 font-sans text-caption uppercase tracking-[0.05em] transition-colors ${
                activeSeries === s
                  ? "border-ink bg-ink text-cream"
                  : "border-ink/30 text-ink hover:border-ink"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 md:mt-8 md:grid-cols-4">
        {filtered.map((chapter) => (
          <CollectionItem key={chapter.slug} chapter={chapter} stockLabel={stockLabels[chapter.slug]} />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="mt-10 text-body-s text-secondary-text">No caps in this series yet.</p>
      )}
    </>
  );
}
