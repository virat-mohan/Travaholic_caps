import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";
import { getAllChapters } from "@/lib/chapters-dynamic";

export const runtime = "nodejs";

// Satori takes TTF/OTF/WOFF, not WOFF2 — asking Google's CSS API without a
// browser user-agent returns plain TTF URLs.
async function googleFont(family: string, weight: number): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}`)
    ).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1];
    if (!url) return null;
    return await (await fetch(url)).arrayBuffer();
  } catch {
    return null;
  }
}

async function loadPublicImage(rel: string): Promise<string | null> {
  try {
    const bytes = await readFile(path.join(process.cwd(), "public", rel));
    return `data:image/png;base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Catalog image for Meta dynamic product ads — used ONLY by the ad feed,
 * never on the site. public/images/catalog-scene/<slug>.png is a one-off
 * image-to-image composite of the real product photo placed into the scene
 * the cap is inspired by (shadow, perspective and lighting from the model,
 * cap pixel-faithful to the reference). This route only adds the logo and
 * the cap's name, so placements that don't print a caption (Reels, Stories)
 * still say which cap it is.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const chapters = await getAllChapters();
  const chapter = chapters.find((c) => c.slug === slug);
  if (!chapter) return new Response("Not found", { status: 404 });

  const [scene, logo, font] = await Promise.all([
    loadPublicImage(`images/catalog-scene/${slug}.png`),
    loadPublicImage("images/brand/travaholic-logo-color-v2.png"),
    googleFont("Bebas Neue", 400),
  ]);
  if (!scene) return new Response("No catalog scene for this chapter yet", { status: 404 });

  const name = chapter.name.toUpperCase();
  const nameSize = name.length > 16 ? 116 : name.length > 12 ? 136 : 156;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#101820" }}>
        <img src={scene} width={1080} height={1080} style={{ position: "absolute", top: 0, left: 0, objectFit: "cover" }} alt="" />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1080,
            height: 1080,
            display: "flex",
            backgroundImage:
              "linear-gradient(180deg, rgba(16,24,32,0.38) 0%, rgba(16,24,32,0) 20%, rgba(16,24,32,0) 62%, rgba(16,24,32,0.78) 100%)",
          }}
        />
        {logo ? <img src={logo} height={130} style={{ position: "absolute", top: 36, left: 40 }} alt="" /> : null}
        <div
          style={{
            position: "absolute",
            bottom: 44,
            left: 0,
            width: 1080,
            display: "flex",
            justifyContent: "center",
            fontFamily: "Display",
            fontSize: nameSize,
            lineHeight: 1,
            color: "#f0eee4",
            letterSpacing: 6,
            textShadow: "0 4px 28px rgba(0,0,0,0.6)",
          }}
        >
          {name}
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1080,
      fonts: font ? [{ name: "Display", data: font, weight: 400, style: "normal" }] : [],
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" },
    }
  );
}
