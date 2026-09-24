"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

export type GalleryPost = {
  file: string;
  src: string;
  testimonial: string;
  chapters: { slug: string; name: string }[];
};

const MIN_SCALE = 1;
const MAX_SCALE = 4;

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Grid of Explorer photos that opens into a zoomable viewer — pinch, wheel,
 * double-tap or the +/- buttons zoom up to 4x and you can drag the photo
 * around, so someone can actually inspect the cap in a travel shot instead
 * of squinting at a 4:5 thumbnail.
 */
export function ExplorerGallery({ posts }: { posts: GalleryPost[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null);
  const lastTapRef = useRef(0);

  const reset = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const open = useCallback(
    (i: number) => {
      setOpenIndex(i);
      reset();
    },
    [reset]
  );
  const close = useCallback(() => setOpenIndex(null), []);
  const step = useCallback(
    (delta: number) => {
      if (openIndex === null) return;
      setOpenIndex((openIndex + delta + posts.length) % posts.length);
      reset();
    },
    [openIndex, posts.length, reset]
  );

  const zoomTo = useCallback((next: number) => {
    const s = clamp(next, MIN_SCALE, MAX_SCALE);
    setScale(s);
    if (s === 1) setOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (openIndex === null) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "+" || e.key === "=") zoomTo(scale + 0.5);
      if (e.key === "-") zoomTo(scale - 0.5);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [openIndex, close, step, zoomTo, scale]);

  const post = openIndex === null ? null : posts[openIndex];

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    zoomTo(scale - e.deltaY * 0.0025);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (scale === 1) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    setOffset({ x: dragRef.current.ox + (e.clientX - dragRef.current.x), y: dragRef.current.oy + (e.clientY - dragRef.current.y) });
  }
  function onPointerUp() {
    dragRef.current = null;
  }

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      pinchRef.current = { dist: d, scale };
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapRef.current < 300) zoomTo(scale > 1 ? 1 : 2.5);
      lastTapRef.current = now;
    }
  }
  function onTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && pinchRef.current) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      zoomTo(pinchRef.current.scale * (d / pinchRef.current.dist));
    }
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (e.touches.length < 2) pinchRef.current = null;
  }

  return (
    <>
      <div className="mt-16 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
        {posts.map((p, i) => (
          <div key={p.file}>
            <button
              type="button"
              onClick={() => open(i)}
              aria-label={`View photo: ${p.testimonial}`}
              className="group relative block w-full aspect-[4/5] overflow-hidden bg-surface-alt"
            >
              <Image src={p.src} alt={p.testimonial} fill sizes="(min-width: 768px) 25vw, 50vw" className="object-cover transition-transform duration-500 ease-out group-hover:scale-105" />
              <span className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-ink/70 text-cream opacity-80 transition-opacity group-hover:opacity-100">
                <ZoomIn size={15} strokeWidth={1.75} />
              </span>
            </button>
            <p className="mt-3 text-caption text-secondary-text">&ldquo;{p.testimonial}&rdquo;</p>
            {p.chapters.length > 0 && (
              <p className="mt-2 text-caption uppercase tracking-[0.05em] text-ink">
                Worn by Explorer —{" "}
                {p.chapters.map((c, j) => (
                  <span key={c.slug}>
                    <Link href={`/chapter/${c.slug}`} className="underline underline-offset-4">
                      {c.name}
                    </Link>
                    {j < p.chapters.length - 1 ? " & " : ""}
                  </span>
                ))}
              </p>
            )}
          </div>
        ))}
      </div>

      {post && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-near-black/95" role="dialog" aria-modal="true" aria-label="Explorer photo viewer">
          <div className="flex items-center justify-between px-4 py-3 text-cream">
            <p className="max-w-[60%] truncate text-caption text-cream/70">
              {openIndex! + 1} / {posts.length}
            </p>
            <div className="flex items-center gap-2">
              <button aria-label="Zoom out" onClick={() => zoomTo(scale - 0.5)} className="p-2 text-cream/80 hover:text-cream"><ZoomOut size={20} strokeWidth={1.5} /></button>
              <span className="w-10 text-center text-caption text-cream/70">{Math.round(scale * 100)}%</span>
              <button aria-label="Zoom in" onClick={() => zoomTo(scale + 0.5)} className="p-2 text-cream/80 hover:text-cream"><ZoomIn size={20} strokeWidth={1.5} /></button>
              <button aria-label="Reset zoom" onClick={reset} className="p-2 text-cream/80 hover:text-cream"><Maximize2 size={18} strokeWidth={1.5} /></button>
              <button aria-label="Close" onClick={close} className="ml-2 p-2 text-cream hover:text-cream/70"><X size={24} strokeWidth={1.5} /></button>
            </div>
          </div>

          <div
            className="relative flex-1 touch-none select-none overflow-hidden"
            onWheel={onWheel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onDoubleClick={() => zoomTo(scale > 1 ? 1 : 2.5)}
            style={{ cursor: scale > 1 ? "grab" : "zoom-in" }}
          >
            <div
              className="absolute inset-0 transition-transform duration-75 ease-out"
              style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
            >
              <Image src={post.src} alt={post.testimonial} fill sizes="100vw" quality={95} priority className="object-contain" draggable={false} />
            </div>
            {posts.length > 1 && (
              <>
                <button aria-label="Previous photo" onClick={() => step(-1)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-ink/60 p-2 text-cream hover:bg-ink"><ChevronLeft size={22} /></button>
                <button aria-label="Next photo" onClick={() => step(1)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-ink/60 p-2 text-cream hover:bg-ink"><ChevronRight size={22} /></button>
              </>
            )}
          </div>

          <div className="px-4 py-3 text-cream">
            <p className="text-body-s text-cream/90">&ldquo;{post.testimonial}&rdquo;</p>
            {post.chapters.length > 0 && (
              <p className="mt-1 text-caption uppercase tracking-[0.05em] text-cream/70">
                Wearing{" "}
                {post.chapters.map((c, j) => (
                  <span key={c.slug}>
                    <Link href={`/chapter/${c.slug}`} className="text-tan-gold underline underline-offset-4">{c.name}</Link>
                    {j < post.chapters.length - 1 ? " & " : ""}
                  </span>
                ))}
                <span className="ml-3 normal-case tracking-normal text-cream/50">Pinch, scroll or double-tap to zoom</span>
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
