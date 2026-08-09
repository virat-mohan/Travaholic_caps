import { issuesSorted, articlesForIssue } from "@/lib/journal";
import { MagazineCover } from "@/components/journal/MagazineCover";
import { NewsletterBlock } from "@/components/newsletter/NewsletterBlock";
import { FooterEditorial } from "@/components/footer/FooterEditorial";

export default function JournalIndexPage() {
  const issues = issuesSorted();

  return (
    <>
      <main className="mx-auto w-full max-w-[1440px] px-6 pt-32 pb-24 md:px-12 md:pt-40">
        <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">
          Travaholic Journal
        </p>
        <h1 className="mt-2 font-display text-heading-xl uppercase text-ink md:text-display-m">
          Stories From The Trail.
        </h1>
        <p className="mt-4 max-w-md text-body text-secondary-text">
          Road trips, packing lists, and the occasional look behind the sketch — published in
          Issues, like a magazine, not a feed. No ads, no affiliate links.
        </p>

        <div className="mt-16 grid grid-cols-1 gap-10 sm:grid-cols-2 md:grid-cols-3">
          {issues.map((issue) => {
            const articles = articlesForIssue(issue.number);
            if (articles.length === 0) return null;

            return (
              <MagazineCover
                key={issue.number}
                issue={issue}
                articles={articles}
                coverImage={articles[0].heroImage}
              />
            );
          })}
        </div>
      </main>

      <NewsletterBlock />
      <FooterEditorial />
    </>
  );
}
