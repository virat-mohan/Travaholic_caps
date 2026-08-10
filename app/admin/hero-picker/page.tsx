"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type ImageOption = { display: string; value: string };
type ChapterOption = { slug: string; name: string };

export default function HeroPickerPage() {
  const [chapterOptions, setChapterOptions] = useState<ChapterOption[]>([]);
  const [slug, setSlug] = useState<string | null>(null);
  const [images, setImages] = useState<ImageOption[]>([]);
  const [currentPrimary, setCurrentPrimary] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/all-chapters")
      .then((res) => res.json())
      .then((data) => {
        setChapterOptions(data.chapters ?? []);
        if (data.chapters?.[0]) setSlug(data.chapters[0].slug);
      });
  }, []);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setSaved(null);
    fetch(`/api/admin/chapter-images?slug=${encodeURIComponent(slug)}`)
      .then((res) => res.json())
      .then((data) => {
        setImages(data.images ?? []);
        setCurrentPrimary(data.currentPrimary ?? null);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  async function setHero(value: string) {
    setSaved(null);
    await fetch("/api/admin/hero-override", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chapterSlug: slug, primaryImage: value }),
    });
    setCurrentPrimary(value);
    setSaved(value);
  }

  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 pt-28 pb-24 md:px-12">
      <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">
        Internal — not linked in navigation
      </p>
      <h1 className="mt-2 font-display text-heading-l uppercase text-ink">
        Chapter Hero Image Picker
      </h1>
      <p className="mt-2 max-w-lg text-body-s text-secondary-text">
        Pick a Chapter, then click whichever photo should be the hero shown on cards, the
        homepage, and the chapter page. Takes effect immediately, site-wide.
      </p>

      <select
        value={slug ?? ""}
        onChange={(e) => setSlug(e.target.value)}
        className="mt-8 border border-divider bg-surface px-4 py-2 font-sans text-body-s text-ink"
      >
        {chapterOptions.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.name}
          </option>
        ))}
      </select>

      {loading ? (
        <p className="mt-8 text-body-s text-secondary-text">Loading...</p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {images.map((img) => {
            const isCurrent = img.value === currentPrimary;
            return (
              <button key={img.value} onClick={() => setHero(img.value)} className="block text-left">
                <div
                  className={`relative aspect-square overflow-hidden bg-surface-alt ${
                    isCurrent ? "ring-2 ring-ink" : "opacity-80 hover:opacity-100"
                  }`}
                >
                  <Image src={img.display} alt="" fill sizes="200px" className="object-cover object-bottom" />
                </div>
                <p className="mt-1 text-caption uppercase tracking-[0.03em] text-secondary-text">
                  {isCurrent ? "Current Hero" : saved === img.value ? "Saved ✓" : "Set As Hero"}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </main>
  );
}
