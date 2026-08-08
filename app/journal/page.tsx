import Image from "next/image";
import Link from "next/link";
import { allJournalArticlesSorted } from "@/lib/journal";
import { NewsletterBlock } from "@/components/newsletter/NewsletterBlock";
import { FooterEditorial } from "@/components/footer/FooterEditorial";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function JournalIndexPage() {
  const articles = allJournalArticlesSorted();
  const [featured, ...rest] = articles;

  return (
    <>
      <main className="mx-auto w-full max-w-[1440px] px-6 pt-32 pb-24 md:px-12 md:pt-40">
        <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">The Journal</p>
        <h1 className="mt-2 font-display text-heading-xl uppercase text-ink md:text-display-m">
          Stories From The Trail.
        </h1>
        <p className="mt-4 max-w-md text-body text-secondary-text">
          Road trips, packing lists, and the occasional look behind the sketch. No ads, no
          affiliate links — just the stuff worth reading before your next trip.
        </p>

        {featured && (
          <Link href={`/journal/${featured.slug}`} className="group mt-16 block">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-10">
              <div className="relative aspect-[4/3] overflow-hidden bg-surface-alt">
                <Image
                  src={featured.heroImage}
                  alt={featured.title}
                  fill
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />
              </div>
              <div className="flex flex-col justify-center">
                <p className="text-caption uppercase tracking-[0.1em] text-secondary-text">
                  {featured.category} · {formatDate(featured.publishedAt)}
                </p>
                <p className="mt-3 font-display text-heading-l uppercase leading-[0.95] text-ink md:text-heading-xl">
                  {featured.title}
                </p>
                <p className="mt-4 max-w-md text-body text-secondary-text">{featured.excerpt}</p>
                <p className="mt-6 text-caption uppercase tracking-[0.1em] text-ink underline underline-offset-4">
                  Read the story — {featured.readingTime} min
                </p>
              </div>
            </div>
          </Link>
        )}

        <div className="mt-24 grid grid-cols-1 gap-x-8 gap-y-14 border-t border-divider pt-16 md:grid-cols-3">
          {rest.map((article) => (
            <Link key={article.slug} href={`/journal/${article.slug}`} className="group block">
              <div className="relative aspect-[4/5] overflow-hidden bg-surface-alt">
                <Image
                  src={article.heroImage}
                  alt={article.title}
                  fill
                  sizes="(min-width: 768px) 33vw, 100vw"
                  className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                />
              </div>
              <p className="mt-4 text-caption uppercase tracking-[0.1em] text-secondary-text">
                {article.category} · {formatDate(article.publishedAt)}
              </p>
              <p className="mt-2 font-display text-heading-s uppercase leading-tight text-ink">
                {article.title}
              </p>
              <p className="mt-2 text-body-s text-secondary-text">{article.subtitle}</p>
            </Link>
          ))}
        </div>
      </main>

      <NewsletterBlock />
      <FooterEditorial />
    </>
  );
}
