import type { MetadataRoute } from "next";
import { chapters } from "@/lib/chapters";
import { seriesOrder } from "@/lib/series";
import { getAllJournalArticles } from "@/lib/journal-dynamic";
import { getBrandProfile } from "@/lib/brand";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const brand = await getBrandProfile();
  const base = brand.siteUrl.replace(/\/$/, "");
  const now = new Date();

  const staticPages = [
    "",
    "/series",
    "/journal",
    "/about",
    "/community",
    "/patch-gallery",
    "/privacy",
    "/terms",
    "/refund-policy",
    "/shipping-policy",
  ].map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.6,
  }));

  const chapterPages = chapters.map((c) => ({
    url: `${base}/chapter/${c.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }));

  const seriesPages = seriesOrder.map((s) => ({
    url: `${base}/series/${s.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const journalArticles = await getAllJournalArticles();
  const journalPages = journalArticles.map((a) => ({
    url: `${base}/journal/${a.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  return [...staticPages, ...chapterPages, ...seriesPages, ...journalPages];
}
