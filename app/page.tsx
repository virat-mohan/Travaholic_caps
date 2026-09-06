import Image from "next/image";
import Link from "next/link";
import { CollectionItem } from "@/components/collection/CollectionItem";
import { NewsletterBlock } from "@/components/newsletter/NewsletterBlock";
import { FooterEditorial } from "@/components/footer/FooterEditorial";
import { DiscountPromoBanner } from "@/components/ui/DiscountPromoBanner";
import { getAllChapters } from "@/lib/chapters-dynamic";
import { getInventoryMap, stockLabelFor } from "@/lib/inventory";
import { computeWebsiteAnalytics } from "@/lib/website-analytics";
import { getExplorerPosts } from "@/lib/community";
import { chapters } from "@/lib/chapters";

function chapterName(slug: string) {
  return chapters.find((c) => c.slug === slug)?.name ?? slug;
}

// Without this, "/" is fully static — baked once at build/deploy time — so
// the Trending strip below would never actually update day to day the way
// it's meant to. An hour is fresh enough to track daily traffic shifts
// without regenerating the page on every single request.
export const revalidate = 3600;

const pillars = [
  { title: "Premium Materials", copy: "Chosen for how they age, not just how they photograph." },
  { title: "Designed To Last", copy: "Built for the trip after this one, and the one after that." },
  { title: "Comfort First", copy: "A cap you forget you're wearing, until someone asks about it." },
  { title: "Inspired By Stories", copy: "Every Chapter starts with a place, not a spreadsheet." },
];

export default async function Home() {
  const chapters = await getAllChapters();
  // Newest-first, but grouped by series (e.g. every "Blue Horizon" cap
  // together) instead of interleaved — a stable group-by keeps each
  // series' own newest-first order intact within its block.
  const bySeries = new Map<string, typeof chapters>();
  for (const chapter of [...chapters].reverse()) {
    const group = bySeries.get(chapter.series) ?? [];
    group.push(chapter);
    bySeries.set(chapter.series, group);
  }
  const grouped = [...bySeries.values()].flat();

  // Explicit top-row pick — the automatic series grouping put City Slicker
  // right next to Travaholic Black, reading as "3 black caps up top" since
  // both City Slicker chapters lean dark. Pull these four to the front in
  // this exact order; everything else keeps following the grouped order.
  const featuredSlugs = ["travaholic-orange", "travaholic-black", "travaholic-snow", "sunshine"];
  const featured = featuredSlugs
    .map((slug) => grouped.find((c) => c.slug === slug))
    .filter((c): c is (typeof grouped)[number] => !!c);
  const collection = [...featured, ...grouped.filter((c) => !featuredSlugs.includes(c.slug))];
  const inventory = await getInventoryMap();

  // A curated slice of real Explorer photos — the same content that powers
  // /community and each chapter's "Explorers Wearing X" section, surfaced
  // here too so a first-time visitor sees real customers wearing the caps
  // before ever reaching a product page.
  const explorerPosts = await getExplorerPosts();

  // Trending Now — whichever chapters got the most product-page views over
  // the last 7 days, first-party (tracking_events), refreshed by the
  // revalidate above rather than anything manual. A rolling week instead of
  // a single day, since daily view counts are still low enough that one bad
  // (or one lucky) day would swing this around too much to be useful.
  let trending: typeof collection = [];
  try {
    const analytics = await computeWebsiteAnalytics(
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      new Date().toISOString()
    );
    trending = analytics.topViewedChapters
      .map((v) => collection.find((c) => c.slug === v.slug))
      .filter((c): c is (typeof collection)[number] => !!c)
      .slice(0, 4);
  } catch (err) {
    console.error("Homepage: failed to compute trending chapters", err);
  }

  return (
    <>
      <main className="mx-auto w-full max-w-[1440px] px-6 md:px-12">
        <div className="flex justify-center pt-16 md:pt-24">
          <DiscountPromoBanner />
        </div>

        {trending.length > 0 && (
          <section className="border-b border-divider pb-16 pt-8 md:pt-12">
            <p className="mb-6 text-caption uppercase tracking-[0.08em] text-secondary-text">
              Trending Now
            </p>
            <h2 className="mb-8 font-display text-heading-l uppercase leading-[0.95] text-ink">
              Most Viewed This Week.
            </h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
              {trending.map((chapter) => (
                <CollectionItem
                  key={chapter.slug}
                  chapter={chapter}
                  stockLabel={stockLabelFor(inventory[chapter.slug])}
                />
              ))}
            </div>
          </section>
        )}

        <section className="pb-24 pt-8 md:pb-30 md:pt-12">
          <p className="mb-6 text-caption uppercase tracking-[0.08em] text-secondary-text">
            Shop
          </p>
          <h1 className="mb-3 font-display text-heading-xl uppercase leading-[0.95] text-ink md:text-display-m">
            The Collection.
          </h1>
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
            {collection.map((chapter) => (
              <CollectionItem
                key={chapter.slug}
                chapter={chapter}
                stockLabel={stockLabelFor(inventory[chapter.slug])}
              />
            ))}
          </div>
        </section>

        {explorerPosts.length > 0 && (
          <section className="border-t border-divider py-24 md:py-30">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="mb-2 text-caption uppercase tracking-[0.08em] text-secondary-text">
                  Explorers
                </p>
                <h2 className="font-display text-heading-l uppercase leading-[0.95] text-ink">
                  Real People. Real Journeys.
                </h2>
              </div>
              <Link
                href="/community"
                className="whitespace-nowrap border border-ink px-6 py-3 font-sans text-body-s font-bold uppercase tracking-[0.1em] text-ink transition-colors duration-300 hover:bg-ink hover:text-cream"
              >
                See Explorers Wearing It
              </Link>
            </div>

            <div className="mt-10 -mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-4 md:-mx-12 md:px-12">
              {explorerPosts.map((post) => {
                const primarySlug = post.chapterSlugs[0];
                return (
                  <div
                    key={post.file}
                    className="w-[45vw] flex-none snap-start sm:w-[30vw] md:w-[22vw] lg:w-[240px]"
                  >
                    <Link
                      href={primarySlug ? `/chapter/${primarySlug}` : "/community"}
                      className="group block"
                    >
                      <div className="relative aspect-[4/5] overflow-hidden bg-surface-alt">
                        <Image
                          src={post.src}
                          alt={post.testimonial}
                          fill
                          sizes="(min-width: 1024px) 240px, (min-width: 768px) 22vw, (min-width: 640px) 30vw, 45vw"
                          className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                        />
                      </div>
                    </Link>
                    <p className="mt-3 text-caption text-secondary-text">
                      &ldquo;{post.testimonial}&rdquo;
                    </p>
                    {primarySlug && (
                      <p className="mt-2 text-caption uppercase tracking-[0.05em] text-ink">
                        Worn by Explorer —{" "}
                        <Link href={`/chapter/${primarySlug}`} className="underline underline-offset-4">
                          {chapterName(primarySlug)}
                        </Link>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="grid grid-cols-2 gap-8 border-t border-divider py-24 md:grid-cols-4 md:py-30">
          {pillars.map((p) => (
            <div key={p.title}>
              <p className="text-body-s text-charcoal">{p.title}</p>
              <p className="mt-2 text-caption text-secondary-text">{p.copy}</p>
            </div>
          ))}
        </section>
      </main>

      <NewsletterBlock />
      <FooterEditorial />
    </>
  );
}
