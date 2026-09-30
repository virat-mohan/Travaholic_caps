import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";
import { getAllChapters } from "@/lib/chapters-dynamic";
import { chapterImageSrc, resolveChapterSlug } from "@/lib/chapters";

export const runtime = "nodejs";

const CREAM = "#F5F3EF";
const INK = "#101820";

async function imageDataUri(src: string): Promise<string | null> {
  try {
    if (/^https?:\/\//.test(src)) {
      const res = await fetch(src);
      if (!res.ok) return null;
      const type = res.headers.get("content-type") ?? "image/png";
      if (type.includes("webp")) return null;
      return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
    }
    const type = /\.jpe?g$/i.test(src) ? "image/jpeg" : "image/png";
    try {
      const bytes = await readFile(path.join(process.cwd(), "public", decodeURI(src)));
      return `data:${type};base64,${bytes.toString("base64")}`;
    } catch {
      const res = await fetch(`https://www.travaholic.in${encodeURI(decodeURI(src))}`);
      return res.ok ? `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}` : null;
    }
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawItems = searchParams.get("items") || searchParams.get("item") || "city-slicker:1";

  // Parse items suffix: e.g. "junglee:1" or "city-slicker:1,travaholic-sky:1"
  const itemEntries = rawItems
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [slug, qtyStr] = s.split(":");
      return { slug: slug?.toLowerCase() ?? "", quantity: Number(qtyStr) || 1 };
    })
    .filter((i) => i.slug);

  const chapters = await getAllChapters().catch(() => []);
  const resolvedItems = itemEntries.slice(0, 4).map((entry) => {
    const canonicalSlug = resolveChapterSlug(entry.slug);
    const chapter = chapters.find(
      (c) => c.slug === canonicalSlug || c.name.toLowerCase() === canonicalSlug.replace(/[-_]/g, " ")
    );
    return {
      name: chapter ? chapter.name : canonicalSlug.replace(/[-_]/g, " ").toUpperCase(),
      series: chapter?.series ?? "Postcards from India",
      slug: canonicalSlug,
      imagePath: chapter && chapter.primary ? chapterImageSrc(chapter.folder, chapter.primary) : null,
      quantity: entry.quantity,
    };
  });

  const heroItem = resolvedItems[0] || {
    name: "CITY SLICKER",
    series: "SOUTH MUMBAI",
    slug: "city-slicker-black",
    imagePath: "/images/chapters/City Slicker Black/IMG_1834_no_bg.png",
    quantity: 1,
  };

  const [logo, capPhoto] = await Promise.all([
    imageDataUri("/images/brand/travaholic-logo-color-black-text.png"),
    heroItem.imagePath ? imageDataUri(heroItem.imagePath) : Promise.resolve(null),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: CREAM,
          position: "relative",
        }}
      >
        {/* Soft circular ambient pedestal */}
        <div
          style={{
            position: "absolute",
            width: 620,
            height: 620,
            borderRadius: 310,
            backgroundColor: "#EAE6DE",
            opacity: 0.85,
          }}
        />

        {/* Brand Roundel Logo in Top-Left corner */}
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            width={110}
            height={110}
            style={{
              position: "absolute",
              top: 36,
              left: 36,
              filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.12))",
            }}
            alt=""
          />
        )}

        {/* Large Studio Cap Product Photography */}
        {capPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={capPhoto}
            width={720}
            height={640}
            style={{
              objectFit: "contain",
              filter: "drop-shadow(0 30px 42px rgba(0,0,0,0.16))",
              position: "relative",
            }}
            alt=""
          />
        ) : (
          <div
            style={{
              display: "flex",
              fontSize: 52,
              color: INK,
              fontWeight: 700,
            }}
          >
            {heroItem.name}
          </div>
        )}
      </div>
    ),
    {
      width: 800,
      height: 800,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    }
  );
}
