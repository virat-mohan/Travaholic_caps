import Image from "next/image";
import { chapterImageSrc, chapters } from "@/lib/chapters";

const CORNER_SLUGS = ["wildling", "travaholic-ocean", "dunes-maroon", "city-slicker-black"];

const POSITIONS = [
  "left-[4%] top-[14%] -rotate-6",
  "right-[4%] top-[18%] rotate-6",
  "left-[7%] bottom-[10%] rotate-3",
  "right-[7%] bottom-[14%] -rotate-3",
];

export function SplashHero() {
  const corners = CORNER_SLUGS.map((slug) => chapters.find((c) => c.slug === slug)).filter(
    (c): c is NonNullable<typeof c> => Boolean(c)
  );

  return (
    <section className="relative flex min-h-[100vh] flex-col items-center justify-center overflow-hidden bg-cream px-6">
      {corners.map((chapter, i) => (
        <div
          key={chapter.slug}
          className={`absolute hidden h-[220px] w-[220px] shadow-[0_20px_40px_-10px_rgba(16,24,32,0.35)] md:block ${POSITIONS[i]}`}
        >
          <Image
            src={chapterImageSrc(chapter.folder, chapter.primary)}
            alt={chapter.name}
            fill
            sizes="220px"
            className="object-cover"
          />
        </div>
      ))}

      <Image
        src="/images/brand/travaholic-logo-color.png"
        alt="Travaholic"
        width={220}
        height={220}
        priority
        className="relative z-10 h-40 w-40 md:h-56 md:w-56"
      />

      <p className="relative z-10 mt-8 font-display text-heading-l uppercase text-ink md:text-heading-xl">
        Stories You Can Wear
      </p>

      <div className="absolute inset-x-6 bottom-10 flex flex-col items-center gap-4 md:inset-x-16">
        <div className="h-px w-full bg-ink/25" />
        <p className="font-sans text-micro uppercase tracking-[0.2em] text-secondary-text">
          Premium Trucker Caps — Made In India
        </p>
      </div>
    </section>
  );
}
