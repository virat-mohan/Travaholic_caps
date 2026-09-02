import { CollectionItem } from "@/components/collection/CollectionItem";
import { NewsletterBlock } from "@/components/newsletter/NewsletterBlock";
import { FooterEditorial } from "@/components/footer/FooterEditorial";
import { DiscountPromoBanner } from "@/components/ui/DiscountPromoBanner";
import { getAllChapters } from "@/lib/chapters-dynamic";
import { getInventoryMap, stockLabelFor } from "@/lib/inventory";
import { computeWebsiteAnalytics } from "@/lib/website-analytics";

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
  const collection = [...bySeries.values()].flat();
  const inventory = await getInventoryMap();

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
          <DiscountPromoBanner className="mb-8" />
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
