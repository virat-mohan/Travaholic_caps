"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NAV_SECTIONS } from "./nav";

const ITEMS = (() => {
  const seen = new Set<string>();
  const out: { href: string; label: string; section: string }[] = [];
  for (const s of NAV_SECTIONS)
    for (const l of s.links)
      if (!seen.has(l.href)) {
        seen.add(l.href);
        out.push({ ...l, section: s.label });
      }
  return out;
})();

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ITEMS;
    return ITEMS.filter((i) => `${i.label} ${i.section}`.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  if (!open) return null;

  const go = (href: string) => {
    onClose();
    setQuery("");
    setActive(0);
    router.push(href);
  };

  return (
    <div
      className="admin-fade fixed inset-0 z-50 flex items-start justify-center bg-overlay px-4 pt-[12vh]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Jump to an admin page"
    >
      <div className="admin-rise w-full max-w-lg overflow-hidden rounded-2xl border border-divider bg-surface shadow-2xl">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            else if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && results[active]) go(results[active].href);
          }}
          placeholder="Jump to a page…"
          className="w-full border-b border-divider bg-transparent px-5 py-4 text-body-s text-ink outline-none placeholder:text-secondary-text"
        />
        <ul className="max-h-[50vh] overflow-y-auto p-2" role="listbox">
          {results.length === 0 && (
            <li className="px-3 py-6 text-center text-body-s text-secondary-text">
              Nothing matches “{query}”. Try a shorter word.
            </li>
          )}
          {results.map((r, i) => (
            <li key={r.href} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r.href)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-body-s ${
                  i === active ? "bg-surface-alt text-ink" : "text-ink"
                }`}
              >
                <span className="truncate">{r.label}</span>
                <span className="shrink-0 text-micro uppercase tracking-[0.1em] text-secondary-text">
                  {r.section}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="border-t border-divider px-5 py-2.5 text-micro text-secondary-text">
          ↑ ↓ to move · Enter to open · Esc to close
        </p>
      </div>
    </div>
  );
}
