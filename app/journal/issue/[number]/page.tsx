import { notFound } from "next/navigation";
import {
  journalIssues,
  getIssue,
  articlesForIssue,
  featuredChaptersForIssue,
} from "@/lib/journal";
import { MagazineReader } from "@/components/journal/MagazineReader";

export function generateStaticParams() {
  return journalIssues.map((i) => ({ number: String(i.number) }));
}

export default async function JournalIssuePage({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>;
  searchParams: Promise<{ article?: string }>;
}) {
  const { number } = await params;
  const { article } = await searchParams;
  const issueNumber = Number(number);
  const issue = getIssue(issueNumber);
  if (!issue) notFound();

  const articles = articlesForIssue(issueNumber);
  const featuredChapters = featuredChaptersForIssue(issueNumber);

  return (
    <MagazineReader
      issue={issue}
      articles={articles}
      featuredChapters={featuredChapters}
      startSlug={article}
    />
  );
}
