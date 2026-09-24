import { NextResponse } from "next/server";
import { getAllChapters } from "@/lib/chapters-dynamic";
import { chapterImageSrc } from "@/lib/chapters";
import { getInventoryMap } from "@/lib/inventory";
import { getBrandProfile } from "@/lib/brand";

import { readdirSync } from "fs";
import path from "path";

const SCENE_SLUGS = new Set(
  (() => {
    try {
      return readdirSync(path.join(process.cwd(), "public/images/catalog-scene")).map((f) => f.replace(/\.png$/, ""));
    } catch {
      return [];
    }
  })()
);

function csvField(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Meta Commerce Manager product feed (CSV) — one row per Chapter, refreshed
 * live from the same data every other page on the site reads from. Point a
 * scheduled fetch at this URL from Commerce Manager instead of hand-maintaining
 * a spreadsheet; availability updates automatically as inventory changes.
 * Spec: https://www.facebook.com/business/help/120325381656392
 */
export async function GET() {
  const [chapters, inventory, brand] = await Promise.all([
    getAllChapters(),
    getInventoryMap(),
    getBrandProfile(),
  ]);
  const siteUrl = brand.siteUrl.replace(/\/$/, "");

  const header = [
    "id",
    "title",
    "description",
    "availability",
    "condition",
    "price",
    "link",
    "image_link",
    "brand",
  ].join(",");

  const rows = chapters.map((chapter) => {
    const stock = inventory[chapter.slug] ?? 0;
    const availability = stock > 0 ? "in stock" : "out of stock";
    // Ad-only scene image (cap placed in the place it's inspired by, name
    // baked in) when one exists; the site itself never uses these.
    const image = chapterImageSrc(chapter.folder, chapter.sideImage);
    const imageUrl = SCENE_SLUGS.has(chapter.slug)
      ? `${siteUrl}/api/og/catalog/${chapter.slug}`
      : image.startsWith("http") ? image : `${siteUrl}${image}`;

    return [
      csvField(chapter.slug),
      csvField(chapter.name),
      csvField(chapter.story.slice(0, 500)),
      csvField(availability),
      csvField("new"),
      csvField(`${chapter.price} INR`),
      csvField(`${siteUrl}/chapter/${chapter.slug}`),
      csvField(imageUrl),
      csvField(brand.brandName),
    ].join(",");
  });

  const csv = [header, ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
