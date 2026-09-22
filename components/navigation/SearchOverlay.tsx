"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { Search, X } from "lucide-react";

type Result = { slug: string; name: string; series: string; price: number; image: string };

export function SearchOverlay() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const trimmedQuery = query.trim();

  useEffect(() => {
    if (trimmedQuery.length < 2) return;
    const handle = setTimeout(() => {
      setLoading(true);
      fetch(`/api/search?q=${encodeURIComponent(trimmedQuery)}`)
        .then((res) => res.json())
        .then((data) => setResults(data.results ?? []))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(handle);
  }, [trimmedQuery]);

  const shownResults = trimmedQuery.length < 2 ? [] : results;

  function close() {
    setOpen(false);
    setQuery("");
    setResults([]);
  }

  return (
    <>
      <button
        aria-label="Search"
        onClick={() => setOpen(true)}
        className="text-cream transition-colors hover:text-cream/70"
      >
        <Search size={18} strokeWidth={1.5} />
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[60] bg-near-black/95">
            <div className="mx-auto flex h-full w-full max-w-[720px] flex-col px-6 pt-24 md:px-0">
              <div className="flex items-center gap-4 border-b border-cream/20 pb-4">
                <Search size={20} strokeWidth={1.5} className="text-cream/50" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search caps, series..."
                  className="w-full bg-transparent font-sans text-body text-cream placeholder:text-cream/40 focus:outline-none"
                />
                <button aria-label="Close search" onClick={close} className="text-cream/70 hover:text-cream">
                  <X size={22} strokeWidth={1.5} />
                </button>
              </div>

              <div className="mt-6 flex-1 overflow-y-auto">
                {loading && <p className="text-caption text-cream/50">Searching...</p>}
                {!loading && trimmedQuery.length >= 2 && shownResults.length === 0 && (
                  <p className="text-caption text-cream/50">No caps found for &ldquo;{query}&rdquo;.</p>
                )}
                <ul className="space-y-1">
                  {shownResults.map((r) => (
                    <li key={r.slug}>
                      <Link
                        href={`/chapter/${r.slug}`}
                        onClick={close}
                        className="flex items-center gap-4 py-3 transition-colors hover:bg-cream/5"
                      >
                        <div className="relative h-14 w-14 flex-none overflow-hidden rounded bg-cream/10">
                          <Image src={r.image} alt={r.name} fill sizes="56px" className="object-cover" />
                        </div>
                        <div>
                          <p className="font-sans text-body-s text-cream">{r.name}</p>
                          <p className="text-caption text-cream/50">
                            {r.series} · ₹{r.price.toLocaleString("en-IN")}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
