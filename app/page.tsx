import { ExploreGlobe } from "@/components/globe/ExploreGlobe";
import { RevealOnClick } from "@/components/home/RevealOnClick";
import { ChapterCard } from "@/components/chapter/ChapterCard";
import { SeriesCard } from "@/components/series/SeriesCard";
import { NewsletterBlock } from "@/components/newsletter/NewsletterBlock";
import { FooterEditorial } from "@/components/footer/FooterEditorial";
import { chapters } from "@/lib/chapters";
import { seriesOrder, seriesChapters } from "@/lib/series";
import { getInventoryMap, stockLabelFor } from "@/lib/inventory";

const pillars = [
  { title: "Premium Materials", copy: "Chosen for how they age, not just how they photograph." },
  { title: "Designed To Last", copy: "Built for the trip after this one, and the one after that." },
  { title: "Comfort First", copy: "A cap you forget you're wearing, until someone asks about it." },
  { title: "Inspired By Stories", copy: "Every Chapter starts with a place, not a spreadsheet." },
];

export default async function Home() {
  const featured = chapters.slice(0, 8);
  const inventory = await getInventoryMap();

  return (
    <>
      <ExploreGlobe />

      <RevealOnClick>
      <main className="mx-auto w-full max-w-[1440px] px-6 md:px-12">
        <section className="pt-4 md:pt-8">
          <p className="mb-6 text-caption uppercase tracking-[0.08em] text-secondary-text">
            Story Series
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {seriesOrder.map((s, i) => {
              const rep = seriesChapters(s.name)[0];
              if (!rep) return null;
              return (
                <SeriesCard
                  key={s.slug}
                  name={s.name}
                  slug={s.slug}
                  blurb={s.blurb}
                  representative={rep}
                  index={i}
                />
              );
            })}
          </div>
        </section>

        <section className="mx-auto max-w-[760px] py-24 text-center md:py-30">
          <p className="font-display text-heading-l text-charcoal md:text-heading-xl">
            My love for caps was inspired by an outdoorsy childhood in Durban — surfing, hiking,
            hanging by the beach, seldom without a cap on my head.
          </p>
          <p className="mt-6 text-body text-secondary-text">
            Every Chapter starts as a sketch, old-school charcoal and paper, before it's
            digitised and sampled until the colours carry the memory of the place that inspired
            it. A cap has got to be your favourite travel companion — not a product you bought,
            a moment you're still wearing.
          </p>
          <p className="mt-4 text-caption text-secondary-text">— Ishan Seth, Founder</p>
        </section>

        <section className="pb-24 md:pb-30">
          <p className="mb-6 text-caption uppercase tracking-[0.08em] text-secondary-text">
            Featured Chapters
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
            {featured.map((chapter, i) => (
              <ChapterCard
                key={chapter.slug}
                chapter={chapter}
                index={i}
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
      </RevealOnClick>
    </>
  );
}
