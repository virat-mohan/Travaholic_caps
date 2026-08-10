import { notFound } from "next/navigation";
import Image from "next/image";
import { seriesOrder } from "@/lib/series";
import { chapterImageSrc } from "@/lib/chapters";
import { getAllChapters } from "@/lib/chapters-dynamic";
import { ChapterCard } from "@/components/chapter/ChapterCard";
import { getInventoryMap, stockLabelFor } from "@/lib/inventory";
import { NewsletterBlock } from "@/components/newsletter/NewsletterBlock";
import { FooterEditorial } from "@/components/footer/FooterEditorial";

export function generateStaticParams() {
  return seriesOrder.map((s) => ({ slug: s.slug }));
}

export default async function SeriesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const series = seriesOrder.find((s) => s.slug === slug);
  if (!series) notFound();

  const allChapters = await getAllChapters();
  const chapters = allChapters.filter((c) => c.series === series.name);
  const hero = chapters[0];
  const inventory = await getInventoryMap();

  return (
    <>
      <section className="relative flex min-h-[60vh] items-end overflow-hidden bg-charcoal">
        {hero && (
          <Image
            src={chapterImageSrc(hero.folder, hero.primary)}
            alt={series.name}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="relative z-10 px-6 py-12 md:px-16 md:py-16">
          <p className="text-caption uppercase tracking-[0.08em] text-white/70">Story Series</p>
          <h1 className="mt-2 font-display text-display-m text-white">{series.name}</h1>
          <p className="mt-3 max-w-md text-body text-white/85">{series.blurb}</p>
        </div>
      </section>

      <main className="mx-auto w-full max-w-[1440px] px-6 py-16 md:px-12">
        <p className="mb-6 text-caption uppercase tracking-[0.08em] text-secondary-text">
          Available Chapters
        </p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
          {chapters.map((chapter, i) => (
            <ChapterCard
              key={chapter.slug}
              chapter={chapter}
              index={i}
              stockLabel={stockLabelFor(inventory[chapter.slug])}
            />
          ))}
        </div>
      </main>

      <NewsletterBlock />
      <FooterEditorial />
    </>
  );
}
