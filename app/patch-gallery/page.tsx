import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import { chapters } from "@/lib/chapters";

function getPatches() {
  const dir = path.join(process.cwd(), "public/images/patches");
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
    .map((file) => {
      const slug = file.replace(/\.(png|jpe?g|webp)$/i, "");
      const chapter = chapters.find((c) => c.slug === slug);
      return {
        file,
        src: `/images/patches/${encodeURIComponent(file)}`,
        name: chapter?.name ?? slug,
      };
    });
}

export default function PatchGalleryPage() {
  const patches = getPatches();
  const missing = chapters.filter((c) => !patches.some((p) => p.file.startsWith(c.slug)));

  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 pt-32 pb-24 md:px-12 md:pt-40">
      <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">
        Internal — not linked in navigation
      </p>
      <h1 className="mt-2 font-display text-heading-xl uppercase text-ink">Patch Gallery</h1>
      <p className="mt-3 max-w-md text-body-s text-secondary-text">
        Cropped front-patch graphics extracted from real product photography. {patches.length} of{" "}
        {chapters.length} chapters done so far — this page reflects whatever&apos;s on disk right
        now.
      </p>

      <div className="mt-14 grid grid-cols-2 gap-8 sm:grid-cols-3 md:grid-cols-4">
        {patches.map((p) => (
          <div key={p.file}>
            <div className="relative aspect-square overflow-hidden bg-surface-alt">
              <Image
                src={p.src}
                alt={p.name}
                fill
                sizes="(min-width: 768px) 25vw, 50vw"
                className="object-contain"
              />
            </div>
            <p className="mt-2 text-center text-caption uppercase tracking-[0.05em] text-ink">
              {p.name}
            </p>
          </div>
        ))}
      </div>

      {missing.length > 0 && (
        <div className="mt-16 border-t border-divider pt-8">
          <p className="text-caption uppercase tracking-[0.1em] text-secondary-text">
            Not cropped yet
          </p>
          <p className="mt-2 text-body-s text-secondary-text">
            {missing.map((c) => c.name).join(", ")}
          </p>
        </div>
      )}
    </main>
  );
}
