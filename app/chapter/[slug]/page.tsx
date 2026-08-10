import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { chapters, chapterImageSrc, SHARED_SPECS } from "@/lib/chapters";
import { seriesChapters } from "@/lib/series";
import { getExplorerPostsForChapter } from "@/lib/community";
import { getInventoryMap, stockLabelFor } from "@/lib/inventory";
import { Product360Viewer } from "@/components/chapter/Product360Viewer";
import { ChapterCard } from "@/components/chapter/ChapterCard";
import { WhyYoullLoveIt } from "@/components/chapter/WhyYoullLoveIt";
import { AddToCartButton } from "@/components/chapter/AddToCartButton";
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
  const explorerPosts = getExplorerPostsForChapter(chapter.slug);
  const inventory = await getInventoryMap();
  const stock = inventory[chapter.slug];
  const stockLabel = stockLabelFor(stock);

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

            {stockLabel && (
              <p
                className={`mt-4 font-sans text-caption font-bold uppercase tracking-[0.05em] ${
                  stockLabel === "out-of-stock" ? "text-paint-orange" : "text-tan-gold"
                }`}
              >
                {stockLabel === "out-of-stock" ? "Out of Stock" : "Selling Fast"}
              </p>
            )}

            <div className="mt-10 flex items-center gap-4">
              <AddToCartButton
                chapter={chapter}
                image={chapterImageSrc(chapter.folder, chapter.primary)}
                disabled={stockLabel === "out-of-stock"}
              />
              <span className="flex flex-col font-sans text-caption text-secondary-text sm:flex-row sm:gap-1">
                <span>One size</span>
                <span className="hidden sm:inline">·</span>
                <span>52–60cm</span>
              </span>
            </div>

            <div className="mt-10 space-y-2 border-t border-divider pt-6 font-sans text-caption uppercase tracking-[0.03em] text-secondary-text">
              {SHARED_SPECS.map((spec) => (
                <p key={spec}>{spec}</p>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-24 md:mt-32">
          <WhyYoullLoveIt slug={chapter.slug} name={chapter.name} />
        </div>

        {explorerPosts.length > 0 && (
          <section className="mt-24 border-t border-divider pt-16 md:mt-32">
            <p className="mb-6 text-caption uppercase tracking-[0.08em] text-secondary-text">
              Explorers Wearing {chapter.name}
            </p>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {explorerPosts.map((post) => (
                <div key={post.file}>
                  <div className="relative aspect-[4/5] overflow-hidden bg-surface-alt">
                    <Image
                      src={post.src}
                      alt={post.testimonial}
                      fill
                      sizes="(min-width: 768px) 25vw, 50vw"
                      className="object-cover"
                    />
                  </div>
                  <p className="mt-3 text-caption text-secondary-text">
                    &ldquo;{post.testimonial}&rdquo;
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {others.length > 0 && (
          <section className="mt-32 border-t border-divider pt-16">
            <p className="mb-6 text-caption uppercase tracking-[0.08em] text-secondary-text">
              Continue Exploring — {chapter.series}
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
              {others.map((c, i) => (
                <ChapterCard
                  key={c.slug}
                  chapter={c}
                  index={i}
                  stockLabel={stockLabelFor(inventory[c.slug])}
                />
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
