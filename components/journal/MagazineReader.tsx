"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { chapterImageSrc } from "@/lib/chapters";
import type { Chapter } from "@/types/chapter";
import type { JournalArticle, JournalIssue } from "@/lib/journal";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function MagazineReader({
  issue,
  articles,
  featuredChapters,
  startSlug,
}: {
  issue: JournalIssue;
  articles: JournalArticle[];
  featuredChapters: Chapter[];
  startSlug?: string;
}) {
  const startIndex = startSlug ? articles.findIndex((a) => a.slug === startSlug) : -1;
  const [page, setPage] = useState(startIndex >= 0 ? startIndex + 1 : 0);
  const [direction, setDirection] = useState(1);
  const totalPages = articles.length + 1;

  function goTo(next: number) {
    if (next < 0 || next >= totalPages) return;
    setDirection(next > page ? 1 : -1);
    setPage(next);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") goTo(page + 1);
      if (e.key === "ArrowLeft") goTo(page - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const issueTitle = issue.name.replace(/^Issue No\. \d+ — /, "");
  const article = page > 0 ? articles[page - 1] : null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-cream">
      <header className="flex h-16 items-center justify-between border-b border-divider px-6 md:px-12">
        <Link
          href="/journal"
          className="flex items-center gap-2 text-caption uppercase tracking-[0.1em] text-secondary-text hover:text-ink"
        >
          <X size={16} /> Close Issue
        </Link>
        <p className="text-caption uppercase tracking-[0.1em] text-secondary-text">
          {issue.name} · Page {page + 1} of {totalPages}
        </p>
      </header>

      <div className="relative flex-1 overflow-y-auto">
        <AnimatePresence initial={false} mode="wait" custom={direction}>
          <motion.div
            key={page}
            custom={direction}
            initial={{ opacity: 0, x: direction > 0 ? 60 : -60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction > 0 ? -60 : 60 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto w-full max-w-[900px] px-6 py-16 md:px-0"
          >
            {page === 0 ? (
              <div className="text-center">
                <p className="text-caption uppercase tracking-[0.2em] text-secondary-text">
                  Issue No. {String(issue.number).padStart(2, "0")}
                </p>
                <h1 className="mt-4 font-display text-display-m uppercase leading-[0.95] text-ink">
                  {issueTitle}
                </h1>
                <p className="mx-auto mt-4 max-w-md text-body text-secondary-text">
                  {issue.theme}
                </p>

                <div className="mx-auto mt-14 grid grid-cols-2 gap-3 md:grid-cols-4">
                  {articles.slice(0, 4).map((a) => (
                    <div key={a.slug} className="relative aspect-[4/5] overflow-hidden bg-surface-alt">
                      <Image src={a.heroImage} alt={a.title} fill sizes="220px" className="object-cover" />
                    </div>
                  ))}
                </div>

                <div className="mx-auto mt-14 max-w-md border-t border-b border-divider py-8 text-left">
                  <p className="mb-4 text-caption uppercase tracking-[0.1em] text-secondary-text">
                    In This Issue
                  </p>
                  <ol className="space-y-3">
                    {articles.map((a, i) => (
                      <li key={a.slug}>
                        <button
                          onClick={() => goTo(i + 1)}
                          className="group flex w-full gap-3 text-left"
                        >
                          <span className="font-sans text-caption text-secondary-text">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className="font-sans text-body-s uppercase tracking-[0.02em] text-ink group-hover:underline">
                            {a.title}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </div>

                {featuredChapters.length > 0 && (
                  <div className="mx-auto mt-14 max-w-2xl">
                    <p className="mb-6 text-caption uppercase tracking-[0.1em] text-secondary-text">
                      Caps Featured In This Issue
                    </p>
                    <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
                      {featuredChapters.map((c) => (
                        <Link key={c.slug} href={`/chapter/${c.slug}`} className="group block">
                          <div className="relative aspect-square overflow-hidden bg-surface-alt">
                            <Image
                              src={chapterImageSrc(c.folder, c.primary)}
                              alt={c.name}
                              fill
                              sizes="150px"
                              className="object-cover object-bottom transition-transform duration-500 ease-out group-hover:scale-105"
                            />
                          </div>
                          <p className="mt-2 text-caption uppercase tracking-[0.03em] text-ink">
                            {c.name}
                          </p>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => goTo(1)}
                  className="mt-14 border border-ink px-8 py-3 font-sans text-body-s font-bold uppercase tracking-[0.1em] text-ink transition-colors duration-300 hover:bg-ink hover:text-cream"
                >
                  Start Reading
                </button>
              </div>
            ) : article ? (
              <div>
                <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">
                  {article.category} · {formatDate(article.publishedAt)} · {article.readingTime} min
                  read
                </p>
                <h1 className="mt-3 font-display text-heading-l uppercase leading-[0.95] text-ink md:text-heading-xl">
                  {article.title}
                </h1>
                <p className="mt-4 text-body-l text-secondary-text">{article.subtitle}</p>

                <div className="relative mt-10 aspect-[16/9] w-full overflow-hidden bg-surface-alt">
                  <Image
                    src={article.heroImage}
                    alt={article.title}
                    fill
                    sizes="900px"
                    className="object-cover"
                    priority
                  />
                </div>

                <article className="mx-auto mt-12 max-w-[720px]">
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
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>

      <footer className="flex h-16 items-center justify-between border-t border-divider px-6 md:px-12">
        <button
          onClick={() => goTo(page - 1)}
          disabled={page === 0}
          className="flex items-center gap-1 text-caption uppercase tracking-[0.1em] text-ink disabled:text-secondary-text/40"
        >
          <ChevronLeft size={16} /> Prev
        </button>
        <div className="flex gap-1.5">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`h-1.5 w-1.5 rounded-full ${i === page ? "bg-ink" : "bg-divider"}`}
              aria-label={`Go to page ${i + 1}`}
            />
          ))}
        </div>
        <button
          onClick={() => goTo(page + 1)}
          disabled={page === totalPages - 1}
          className="flex items-center gap-1 text-caption uppercase tracking-[0.1em] text-ink disabled:text-secondary-text/40"
        >
          Next <ChevronRight size={16} />
        </button>
      </footer>
    </div>
  );
}
