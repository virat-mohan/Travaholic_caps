import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { journalArticles } from "@/lib/journal";
import {
  getJournalArticle,
  relatedChaptersFor,
} from "@/lib/journal-dynamic";
import { chapterImageSrc } from "@/lib/chapters";
import { NewsletterBlock } from "@/components/newsletter/NewsletterBlock";
import { FooterEditorial } from "@/components/footer/FooterEditorial";

export const revalidate = 3600;

export function generateStaticParams() {
  return journalArticles.map((a) => ({ slug: a.slug }));
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function JournalArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getJournalArticle(slug);
  if (!article) notFound();

  const related = relatedChaptersFor(article);

  return (
    <>
      <main className="mx-auto w-full max-w-[1440px] px-6 pt-32 pb-24 md:px-12 md:pt-40">
        <div className="mx-auto max-w-[760px]">
          <Link
            href="/journal"
            className="text-caption uppercase tracking-[0.1em] text-secondary-text hover:text-ink"
          >
            ← The Journal
          </Link>
          <p className="mt-6 text-caption uppercase tracking-[0.15em] text-secondary-text">
            {article.category} · {formatDate(article.publishedAt)} · {article.readingTime} min read
          </p>
          <h1 className="mt-3 font-display text-heading-l uppercase leading-[0.95] text-ink md:text-heading-xl">
            {article.title}
          </h1>
          <p className="mt-4 text-body-l text-secondary-text">{article.subtitle}</p>
        </div>

        <div className="relative mx-auto mt-12 aspect-[16/9] w-full max-w-[1100px] overflow-hidden bg-surface-alt">
          <Image
            src={article.heroImage}
            alt={article.title}
            fill
            sizes="(min-width: 1100px) 1100px, 100vw"
            className="object-cover"
            priority
          />
        </div>

        <article className="mx-auto mt-14 max-w-[760px]">
          {article.body.map((paragraph, i) =>
            paragraph.startsWith("> ") ? (
              <blockquote
                key={i}
                className="my-10 border-l-2 border-ink pl-6 font-display text-heading-s uppercase leading-tight text-ink"
              >
                {paragraph.slice(2)}
              </blockquote>
            ) : (
              <p key={i} className="mb-6 text-body leading-relaxed text-ink">
                {paragraph}
              </p>
            )
          )}
        </article>

        {related.length > 0 && (
          <section className="mx-auto mt-20 max-w-[760px] border-t border-divider pt-10">
            <p className="mb-6 text-caption uppercase tracking-[0.1em] text-secondary-text">
              Cap Suggestions
            </p>
            <div className="grid grid-cols-2 gap-6">
              {related.map((chapter) => (
                <Link key={chapter.slug} href={`/chapter/${chapter.slug}`} className="group block">
                  <div className="relative aspect-square overflow-hidden bg-surface-alt">
                    <Image
                      src={chapterImageSrc(chapter.folder, chapter.primary)}
                      alt={chapter.name}
                      fill
                      sizes="(min-width: 768px) 30vw, 50vw"
                      className="object-cover object-bottom transition-transform duration-500 ease-out group-hover:scale-105"
                    />
                  </div>
                  <p className="mt-3 text-body-s uppercase tracking-[0.03em] text-ink">
                    {chapter.name}
                  </p>
                  <p className="text-caption text-secondary-text">
                    ₹{chapter.price.toLocaleString("en-IN")}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <NewsletterBlock />
      <FooterEditorial />
    </>
  );
}
