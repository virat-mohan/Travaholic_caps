import { NextResponse } from "next/server";
import { getAllChapters } from "@/lib/chapters-dynamic";
import { chapterImageSrc } from "@/lib/chapters";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const chapters = await getAllChapters();
  const results = chapters
    .filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.series.toLowerCase().includes(q) ||
        c.story.toLowerCase().includes(q)
    )
    .slice(0, 8)
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      series: c.series,
      price: c.price,
      image: chapterImageSrc(c.folder, c.sideImage),
    }));

  return NextResponse.json({ results });
}
