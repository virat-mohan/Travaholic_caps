import { notFound } from "next/navigation";
import { journalIssues } from "@/lib/journal";
import {
  getIssue,
  articlesForIssue,
  featuredChaptersForIssue,
} from "@/lib/journal-dynamic";
import { MagazineReader } from "@/components/journal/MagazineReader";

export const revalidate = 3600;

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

  const articles = await articlesForIssue(issueNumber);
  const featuredChapters = await featuredChaptersForIssue(issueNumber);

  return (
    <MagazineReader
      issue={issue}
      articles={articles}
      featuredChapters={featuredChapters}
      startSlug={article}
    />
  );
}
