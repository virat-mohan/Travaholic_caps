import { notFound } from "next/navigation";
import Link from "next/link";
import { chapters } from "@/lib/chapters";
import { seriesChapters } from "@/lib/series";
import { ChapterGallery } from "@/components/chapter/ChapterGallery";
import { ChapterCard } from "@/components/chapter/ChapterCard";
import { NewsletterBlock } from "@/components/newsletter/NewsletterBlock";
import { FooterEditorial } from "@/components/footer/FooterEditorial";

export function generateStaticParams() {
  return chapters.map((c) => ({ slug: c.slug }));
}

export default async function ChapterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const chapter = chapters.find((c) => c.slug === slug);
  if (!chapter) notFound();

  const others = seriesChapters(chapter.series).filter((c) => c.slug !== chapter.slug);

  return (
    <>
      <main className="mx-auto w-full max-w-[1440px] px-6 pt-28 md:px-12 md:pt-36">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
          <ChapterGallery folder={chapter.folder} images={chapter.images} name={chapter.name} />

          <div className="md:pt-4">
            <Link
              href={`/series/${chapter.series.toLowerCase().replace(/\s+/g, "-")}`}
              className="text-caption uppercase tracking-[0.08em] text-secondary-text"
            >
              {chapter.series}
            </Link>
            <h1 className="mt-2 font-display text-heading-xl text-charcoal">{chapter.name}</h1>
            <p className="mt-6 max-w-md text-body text-secondary-text">{chapter.story}</p>

            <div className="mt-10 flex items-center gap-4">
              <button className="rounded-pill bg-charcoal px-8 py-3 text-body-s text-white transition-transform duration-300 hover:scale-[1.02]">
                Add to Cart
              </button>
              <span className="text-caption text-secondary-text">One size · 52–60cm</span>
            </div>

            <div className="mt-10 space-y-2 border-t border-divider pt-6 text-caption text-secondary-text">
              <p>Free delivery on prepaid orders</p>
              <p>Easy 5 day returns</p>
              <p>Premium packaging</p>
            </div>
          </div>
        </div>

        {others.length > 0 && (
          <section className="mt-32 border-t border-divider pt-16">
            <p className="mb-6 text-caption uppercase tracking-[0.08em] text-secondary-text">
              Continue Exploring — {chapter.series}
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
              {others.map((c, i) => (
                <ChapterCard key={c.slug} chapter={c} index={i} />
              ))}
            </div>
          </section>
        )}
      </main>

      <div className="mt-32">
        <NewsletterBlock />
        <FooterEditorial />
      </div>
    </>
  );
}
