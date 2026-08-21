import { ExploreGlobe } from "@/components/globe/ExploreGlobe";
import { CollectionItem } from "@/components/collection/CollectionItem";
import { NewsletterBlock } from "@/components/newsletter/NewsletterBlock";
import { FooterEditorial } from "@/components/footer/FooterEditorial";
import { getAllChapters } from "@/lib/chapters-dynamic";
import { getInventoryMap, stockLabelFor } from "@/lib/inventory";

const pillars = [
  { title: "Premium Materials", copy: "Chosen for how they age, not just how they photograph." },
  { title: "Designed To Last", copy: "Built for the trip after this one, and the one after that." },
  { title: "Comfort First", copy: "A cap you forget you're wearing, until someone asks about it." },
  { title: "Inspired By Stories", copy: "Every Chapter starts with a place, not a spreadsheet." },
];

export default async function Home() {
  const chapters = await getAllChapters();
  const collection = [...chapters].reverse();
  const inventory = await getInventoryMap();

  return (
    <>
      <main className="mx-auto w-full max-w-[1440px] px-6 md:px-12">
        <section className="pb-24 pt-8 md:pb-30 md:pt-12">
          <p className="mb-6 text-caption uppercase tracking-[0.08em] text-secondary-text">
            Shop
          </p>
          <h1 className="mb-8 font-display text-heading-xl uppercase leading-[0.95] text-ink md:text-display-m">
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
      </main>

      <ExploreGlobe />

      <main className="mx-auto w-full max-w-[1440px] px-6 md:px-12">
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
