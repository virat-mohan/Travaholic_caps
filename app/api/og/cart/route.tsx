import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";
import { getAllChapters } from "@/lib/chapters-dynamic";
import { chapterImageSrc } from "@/lib/chapters";

export const runtime = "nodejs";

const CREAM = "#F5F3EF";
const INK = "#101820";
const GOLD = "#E6C68F";
const MUTED = "#7A756D";

async function googleFont(family: string, weight: number): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}`)
    ).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

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
  const rawItems = searchParams.get("items") || searchParams.get("item") || "travaholic-sky:1";

  // Parse items suffix: e.g. "travaholic-sky:1,travaholic-orange:1"
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
    const chapter = chapters.find(
      (c) => c.slug === entry.slug || c.name.toLowerCase() === entry.slug.replace(/[-_]/g, " ")
    );
    return {
      name: chapter ? chapter.name : entry.slug.replace(/[-_]/g, " ").toUpperCase(),
      series: chapter?.series ?? "Postcards from India",
      slug: entry.slug,
      imagePath: chapter && chapter.primary ? chapterImageSrc(chapter.folder, chapter.primary) : null,
      quantity: entry.quantity,
    };
  });

  const [logo, fontBold, fontRegular, ...photoDataUris] = await Promise.all([
    imageDataUri("/images/brand/travaholic-logo-color-v2.png"),
    googleFont("Inter", 700),
    googleFont("Inter", 500),
    ...resolvedItems.map((item) => (item.imagePath ? imageDataUri(item.imagePath) : Promise.resolve(null))),
  ]);

  const fonts = [
    fontBold && { name: "InterBold", data: fontBold, weight: 700 as const, style: "normal" as const },
    fontRegular && { name: "Inter", data: fontRegular, weight: 500 as const, style: "normal" as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 500 | 700; style: "normal" }[];

  const isSingle = resolvedItems.length <= 1;

  if (isSingle) {
    const item = resolvedItems[0] || { name: "TRAVAHOLIC SKY", series: "CHANDRATAL, SPITI" };
    const capPhoto = photoDataUris[0];

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            backgroundColor: CREAM,
            fontFamily: "InterBold",
            position: "relative",
          }}
        >
          {/* Top-Left Exact Roundel Logo */}
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              width={160}
              height={160}
              style={{
                position: "absolute",
                top: 40,
                left: 40,
                filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.15))",
              }}
              alt=""
            />
          )}

          {/* Large Studio Cap Image in Center */}
          <div
            style={{
              width: "100%",
              height: 950,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "60px 40px 20px 40px",
            }}
          >
            {capPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={capPhoto}
                width={780}
                height={680}
                style={{ objectFit: "contain", filter: "drop-shadow(0 20px 30px rgba(0,0,0,0.08))" }}
                alt=""
              />
            ) : (
              <div style={{ display: "flex", fontSize: 56, color: INK }}>{item.name}</div>
            )}
          </div>

          {/* Bottom Bar */}
          <div
            style={{
              width: "100%",
              height: 130,
              backgroundColor: INK,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 48px",
            }}
          >
            <div style={{ display: "flex", fontSize: 40, color: "#FFFFFF", letterSpacing: 1 }}>
              {item.name.toUpperCase()}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 28,
                color: GOLD,
                letterSpacing: 2,
                fontFamily: "Inter",
              }}
            >
              {item.series.toUpperCase()}
            </div>
          </div>
        </div>
      ),
      {
        width: 1080,
        height: 1080,
        fonts: fonts.length ? fonts : undefined,
        headers: {
          "Cache-Control": "public, max-age=86400, s-maxage=86400",
        },
      }
    );
  }

  // Multi-Cap Grid (Option 3: 2 to 4 Caps)
  const tileCount = resolvedItems.length;
  const tileW = tileCount === 2 ? 480 : 480;
  const tileH = tileCount === 2 ? 700 : 340;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: CREAM,
          fontFamily: "InterBold",
          position: "relative",
        }}
      >
        {/* Header with Roundel Logo */}
        <div
          style={{
            width: "100%",
            height: 180,
            display: "flex",
            alignItems: "center",
            padding: "0 40px",
            gap: 24,
          }}
        >
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              width={140}
              height={140}
              style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.15))" }}
              alt=""
            />
          )}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 40, color: INK, letterSpacing: 1 }}>
              {`YOUR ORDER · ${tileCount} CAPS`}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 24,
                color: MUTED,
                letterSpacing: 2,
                fontFamily: "Inter",
                marginTop: 6,
              }}
            >
              POSTCARDS FROM INDIA COLLECTION
            </div>
          </div>
        </div>

        {/* 2x2 or 2-column Grid of Caps */}
        <div
          style={{
            width: "100%",
            height: 770,
            display: "flex",
            flexWrap: "wrap",
            gap: 20,
            padding: "0 40px",
            alignContent: "center",
            justifyContent: "space-between",
          }}
        >
          {resolvedItems.map((item, idx) => (
            <div
              key={idx}
              style={{
                width: tileW,
                height: tileH,
                backgroundColor: "#FFFFFF",
                borderRadius: 24,
                border: "2px solid #E4E0D8",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
              }}
            >
              {photoDataUris[idx] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoDataUris[idx] as string}
                  width={tileW - 60}
                  height={tileH - 80}
                  style={{ objectFit: "contain" }}
                  alt=""
                />
              ) : (
                <div style={{ display: "flex", fontSize: 24, color: INK }}>{item.name}</div>
              )}
              <div
                style={{
                  display: "flex",
                  fontSize: 26,
                  color: INK,
                  marginTop: 10,
                  letterSpacing: 0.5,
                }}
              >
                {`${item.quantity > 1 ? `${item.quantity}× ` : ""}${item.name}`}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div
          style={{
            width: "100%",
            height: 130,
            backgroundColor: INK,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 48px",
          }}
        >
          <div style={{ display: "flex", fontSize: 38, color: "#FFFFFF", letterSpacing: 1 }}>
            {`${tileCount} ITEMS IN CART`}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 28,
              color: GOLD,
              letterSpacing: 2,
              fontFamily: "Inter",
            }}
          >
            FREE EXPRESS DELIVERY
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1080,
      fonts: fonts.length ? fonts : undefined,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    }
  );
}
