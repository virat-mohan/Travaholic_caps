import Image from "next/image";
import Link from "next/link";
import { issuesSorted, articlesForIssue } from "@/lib/journal";
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
  const issues = issuesSorted();

  return (
    <>
      <main className="mx-auto w-full max-w-[1440px] px-6 pt-32 pb-24 md:px-12 md:pt-40">
        <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">The Journal</p>
        <h1 className="mt-2 font-display text-heading-xl uppercase text-ink md:text-display-m">
          Stories From The Trail.
        </h1>
        <p className="mt-4 max-w-md text-body text-secondary-text">
          Road trips, packing lists, and the occasional look behind the sketch — published in
          Issues, like a magazine, not a feed. No ads, no affiliate links.
        </p>

        {issues.map((issue) => {
          const articles = articlesForIssue(issue.number);
          const [featured, ...rest] = articles;
          if (!featured) return null;

          return (
            <section key={issue.number} className="mt-24 border-t border-divider pt-16 first:mt-16">
              <p className="text-caption uppercase tracking-[0.1em] text-secondary-text">
                Issue No. {String(issue.number).padStart(2, "0")}
              </p>
              <h2 className="mt-2 font-display text-heading-l uppercase text-ink md:text-heading-xl">
                {issue.name.replace(/^Issue No\. \d+ — /, "")}
              </h2>
              <p className="mt-2 max-w-md text-body-s text-secondary-text">{issue.theme}</p>

              <div className="mt-8 border-t border-b border-divider py-6">
                <p className="mb-4 font-display text-caption font-bold uppercase tracking-[0.1em] text-ink">
                  In This Issue
                </p>
                <ol className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2 md:grid-cols-3">
                  {articles.map((article, i) => (
                    <li key={article.slug}>
                      <Link href={`/journal/${article.slug}`} className="group flex gap-3">
                        <span className="font-sans text-caption text-secondary-text">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span>
                          <span className="block font-sans text-body-s uppercase tracking-[0.02em] text-ink group-hover:underline">
                            {article.title}
                          </span>
                          <span className="block text-caption text-secondary-text">
                            {article.category}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </div>

              <Link href={`/journal/${featured.slug}`} className="group mt-10 block">
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
                    <p className="mt-4 max-w-md text-body text-secondary-text">
                      {featured.excerpt}
                    </p>
                    <p className="mt-6 text-caption uppercase tracking-[0.1em] text-ink underline underline-offset-4">
                      Read the story — {featured.readingTime} min
                    </p>
                  </div>
                </div>
              </Link>

              {rest.length > 0 && (
                <div className="mt-16 grid grid-cols-1 gap-x-8 gap-y-14 md:grid-cols-3">
                  {rest.map((article) => (
                    <Link
                      key={article.slug}
                      href={`/journal/${article.slug}`}
                      className="group block"
                    >
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
              )}
            </section>
          );
        })}
      </main>

      <NewsletterBlock />
      <FooterEditorial />
    </>
  );
}
