"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { chapterImageSrc } from "@/lib/chapters";
import { RotateCw } from "lucide-react";

const DRAG_PX_PER_FRAME = 60;

export function Product360Viewer({
  folder,
  images,
  name,
}: {
  folder: string;
  images: string[];
  name: string;
}) {
  const [frame, setFrame] = useState(0);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startFrame = useRef(0);

  const frameCount = images.length;

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    startX.current = e.clientX;
    startFrame.current = frame;
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const delta = e.clientX - startX.current;
    const steps = Math.round(delta / DRAG_PX_PER_FRAME);
    const next = ((startFrame.current + steps) % frameCount + frameCount) % frameCount;
    setFrame(next);
  };

  const onPointerUp = () => {
    dragging.current = false;
  };

  return (
    <div>
      <div
        className="relative aspect-square cursor-grab touch-none select-none overflow-hidden rounded-none bg-surface-alt active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {images.map((img, i) => (
          <Image
            key={img}
            src={chapterImageSrc(folder, img)}
            alt={i === frame ? name : ""}
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
            style={{ opacity: i === frame ? 1 : 0, pointerEvents: "none" }}
            priority={i === 0}
          />
        ))}

        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex items-center justify-center gap-2 font-sans text-micro uppercase tracking-[0.15em] text-secondary-text">
          <RotateCw size={14} strokeWidth={1.5} />
          Drag to Rotate
        </div>
      </div>

      <div className="mt-4 grid grid-cols-5 gap-3">
        {images.map((img, i) => (
          <button
            key={img}
            onClick={() => setFrame(i)}
            className={`relative aspect-square overflow-hidden bg-surface-alt transition-opacity ${
              i === frame ? "opacity-100 ring-1 ring-ink" : "opacity-60 hover:opacity-100"
            }`}
            aria-label={`${name} angle ${i + 1}`}
          >
            <Image src={chapterImageSrc(folder, img)} alt="" fill sizes="120px" className="object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
