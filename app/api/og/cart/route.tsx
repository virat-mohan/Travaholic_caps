import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";
import { getAllChapters } from "@/lib/chapters-dynamic";
import { chapterImageSrc, resolveChapterSlug } from "@/lib/chapters";

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

  const [logo, fontBold, fontRegular, ...photoDataUris] = await Promise.all([
    imageDataUri("/images/brand/travaholic-logo-color-black-text.png"),
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
    const item = resolvedItems[0] || { name: "TRAVAHOLIC SKY", series: "CHANDRATAL, SPITI", quantity: 1 };
    const capPhoto = photoDataUris[0];

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "row",
            backgroundColor: CREAM,
            fontFamily: "InterBold",
            position: "relative",
          }}
        >
          {/* Left Column: Brand, Status, Details, CTA */}
          <div
            style={{
              width: 520,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: "48px 0 44px 56px",
              boxSizing: "border-box",
            }}
          >
            {/* Top: Roundel Logo with Black Text & Category */}
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              {logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logo}
                  width={84}
                  height={84}
                  style={{
                    filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.12))",
                  }}
                  alt=""
                />
              )}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div
                  style={{
                    display: "flex",
                    fontSize: 22,
                    color: INK,
                    letterSpacing: 2,
                    fontFamily: "InterBold",
                  }}
                >
                  TRAVAHOLIC
                </div>
                <div
                  style={{
                    display: "flex",
                    fontSize: 13,
                    color: MUTED,
                    letterSpacing: 2.5,
                    fontFamily: "Inter",
                    marginTop: 4,
                  }}
                >
                  POSTCARDS FROM INDIA
                </div>
              </div>
            </div>

            {/* Middle: Product & Cart Status */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: "#16A34A",
                  }}
                />
                <span
                  style={{
                    fontSize: 14,
                    color: MUTED,
                    letterSpacing: 2,
                    fontFamily: "InterBold",
                  }}
                >
                  YOUR CART IS READY
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 44,
                  lineHeight: 1.1,
                  color: INK,
                  letterSpacing: -0.5,
                  fontFamily: "InterBold",
                }}
              >
                {`${item.quantity > 1 ? `${item.quantity}× ` : ""}${item.name.toUpperCase()}`}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 18,
                  color: "#8C7355",
                  letterSpacing: 2,
                  fontFamily: "Inter",
                  marginTop: 10,
                }}
              >
                {item.series.toUpperCase()}
              </div>
            </div>

            {/* Bottom: Price, Free Express Shipping & Tap CTA */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  backgroundColor: INK,
                  color: "#FFFFFF",
                  padding: "12px 24px",
                  borderRadius: 12,
                  gap: 12,
                  alignSelf: "flex-start",
                }}
              >
                <div style={{ display: "flex", fontSize: 20, fontFamily: "InterBold", letterSpacing: 0.5 }}>
                  {`₹${(1399 * (item.quantity || 1)).toLocaleString("en-IN")}`}
                </div>
                <div style={{ width: 1, height: 18, backgroundColor: "#3A4550" }} />
                <div style={{ display: "flex", fontSize: 14, color: GOLD, fontFamily: "Inter", letterSpacing: 1.5 }}>
                  FREE EXPRESS SHIPPING
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 13,
                  color: MUTED,
                  letterSpacing: 1,
                  fontFamily: "Inter",
                }}
              >
                Tap link to complete order securely on travaholic.in →
              </div>
            </div>
          </div>

          {/* Right Column: High-Res Cap Studio Image with Ambient Glow */}
          <div
            style={{
              width: 680,
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              padding: "20px 40px 20px 10px",
              boxSizing: "border-box",
            }}
          >
            {/* Subtle soft circular ambient backlight */}
            <div
              style={{
                position: "absolute",
                width: 480,
                height: 480,
                borderRadius: 240,
                backgroundColor: "#EAE6DE",
                filter: "blur(20px)",
                opacity: 0.7,
              }}
            />
            {capPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={capPhoto}
                width={580}
                height={500}
                style={{
                  objectFit: "contain",
                  filter: "drop-shadow(0 24px 36px rgba(0,0,0,0.14))",
                  position: "relative",
                }}
                alt=""
              />
            ) : (
              <div style={{ display: "flex", fontSize: 44, color: INK }}>{item.name}</div>
            )}
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        fonts: fonts.length ? fonts : undefined,
        headers: {
          "Cache-Control": "public, max-age=86400, s-maxage=86400",
        },
      }
    );
  }

  // Multi-Cap Grid (2 to 4 Caps)
  const tileCount = resolvedItems.length;

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
          justifyContent: "space-between",
        }}
      >
        {/* Top Header Bar */}
        <div
          style={{
            width: "100%",
            height: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 50px",
            borderBottom: "1px solid #E8E4DC",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                width={64}
                height={64}
                style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.12))" }}
                alt=""
              />
            )}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 24, color: INK, letterSpacing: 1.5 }}>
                TRAVAHOLIC
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 13,
                  color: MUTED,
                  letterSpacing: 2,
                  fontFamily: "Inter",
                }}
              >
                {`YOUR CART · ${tileCount} CAPS`}
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              backgroundColor: INK,
              color: GOLD,
              padding: "8px 20px",
              borderRadius: 20,
              fontSize: 13,
              letterSpacing: 1.5,
              fontFamily: "Inter",
            }}
          >
            FREE EXPRESS SHIPPING ACROSS INDIA
          </div>
        </div>

        {/* Cap Tiles Row */}
        <div
          style={{
            width: "100%",
            height: 450,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
            padding: "0 40px",
          }}
        >
          {resolvedItems.map((item, idx) => {
            const cardWidth = tileCount === 2 ? 520 : tileCount === 3 ? 340 : 255;
            const imgWidth = tileCount === 2 ? 420 : tileCount === 3 ? 280 : 210;
            const imgHeight = tileCount === 2 ? 300 : tileCount === 3 ? 240 : 200;

            return (
              <div
                key={idx}
                style={{
                  width: cardWidth,
                  height: 410,
                  backgroundColor: "#FFFFFF",
                  borderRadius: 20,
                  border: "2px solid #E8E4DC",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "24px 16px 20px 16px",
                  boxShadow: "0 8px 20px rgba(0,0,0,0.04)",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: 280,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {photoDataUris[idx] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoDataUris[idx] as string}
                      width={imgWidth}
                      height={imgHeight}
                      style={{ objectFit: "contain", filter: "drop-shadow(0 12px 20px rgba(0,0,0,0.1))" }}
                      alt=""
                    />
                  ) : (
                    <div style={{ display: "flex", fontSize: 20, color: INK }}>{item.name}</div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
                  <div
                    style={{
                      display: "flex",
                      fontSize: tileCount >= 4 ? 17 : 20,
                      color: INK,
                      fontFamily: "InterBold",
                      textAlign: "center",
                      letterSpacing: 0.5,
                    }}
                  >
                    {`${item.quantity > 1 ? `${item.quantity}× ` : ""}${item.name}`}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      fontSize: 13,
                      color: MUTED,
                      fontFamily: "Inter",
                      letterSpacing: 1.5,
                      marginTop: 4,
                    }}
                  >
                    {item.series.toUpperCase()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Bar */}
        <div
          style={{
            width: "100%",
            height: 80,
            backgroundColor: INK,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 50px",
          }}
        >
          <div style={{ display: "flex", fontSize: 18, color: "#FFFFFF", letterSpacing: 1 }}>
            TAP LINK TO COMPLETE YOUR ORDER ON WWW.TRAVAHOLIC.IN
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 16,
              color: GOLD,
              letterSpacing: 2,
              fontFamily: "Inter",
            }}
          >
            FLAT ₹1,399 EACH
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: fonts.length ? fonts : undefined,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    }
  );
}
