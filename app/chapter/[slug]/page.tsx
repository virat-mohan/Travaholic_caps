import { notFound } from "next/navigation";
import Link from "next/link";
import { chapters, SHARED_SPECS } from "@/lib/chapters";
import { seriesChapters } from "@/lib/series";
import { Product360Viewer } from "@/components/chapter/Product360Viewer";
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
          <Product360Viewer folder={chapter.folder} images={chapter.images} name={chapter.name} />

          <div className="md:pt-4">
            <Link
              href={`/series/${chapter.series.toLowerCase().replace(/\s+/g, "-")}`}
              className="font-sans text-caption uppercase tracking-[0.15em] text-secondary-text"
            >
              {chapter.series}
            </Link>
            <h1 className="mt-2 font-display text-heading-xl uppercase text-ink">{chapter.name}</h1>
            <p className="mt-3 font-sans text-body-l text-ink">
              ₹{chapter.price.toLocaleString("en-IN")}
            </p>
            <p className="mt-6 max-w-md font-sans text-body text-secondary-text">{chapter.story}</p>

            {!chapter.verifiedOnSite && (
              <p className="mt-4 max-w-md font-sans text-caption text-paint-orange">
                Not yet confirmed live on travaholic.in — verify pricing and description before
                publishing.
              </p>
            )}

            <div className="mt-10 flex items-center gap-4">
              <button className="border border-ink bg-ink px-8 py-3 font-sans text-body-s font-bold uppercase tracking-[0.1em] text-cream transition-colors duration-300 hover:bg-cream hover:text-ink">
                Add to Cart
              </button>
              <span className="font-sans text-caption text-secondary-text">One size · 52–60cm</span>
            </div>

            <div className="mt-10 space-y-2 border-t border-divider pt-6 font-sans text-caption uppercase tracking-[0.03em] text-secondary-text">
              {SHARED_SPECS.map((spec) => (
                <p key={spec}>{spec}</p>
              ))}
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
