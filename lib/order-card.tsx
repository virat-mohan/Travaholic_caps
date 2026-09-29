import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";
import { getBrandProfile } from "@/lib/brand";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getAllChapters } from "@/lib/chapters-dynamic";
import { chapterImageSrc } from "@/lib/chapters";

type OrderForCard = {
  id: string;
  total: number;
  customer_name?: string | null;
};
type ItemForCard = { chapter_name: string; quantity: number; chapter_slug?: string | null; unit_price?: number | null };

const INK = "#101820";
const CREAM = "#f0eee4";
const GOLD = "#e6c68f";
const MUTED = "#4a4a42";

// Satori takes TTF/OTF, not WOFF2 — Google's CSS API without a browser
// user-agent returns plain TTF URLs.
async function googleFont(family: string, weight: number): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}`)).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

// Inlined as data URIs — Satori's own remote fetching has been unreliable
// ("unsupported image format" on valid PNGs). Local files are read from
// public/; Storage URLs (admin-added caps) are fetched.
async function imageDataUri(src: string): Promise<string | null> {
  try {
    if (/^https?:\/\//.test(src)) {
      const res = await fetch(src);
      if (!res.ok) return null;
      const type = res.headers.get("content-type") ?? "image/png";
      if (type.includes("webp")) return null; // Satori can't decode WebP
      return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
    }
    const bytes = await readFile(path.join(process.cwd(), "public", decodeURI(src)));
    const type = /\.jpe?g$/i.test(src) ? "image/jpeg" : "image/png";
    return `data:${type};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Renders the "Order Confirmed" card used as the header image on the
 * WhatsApp order-confirmation template (WhatsApp can't render HTML, so this
 * is the designed part of the message). Brand look: ink header with the
 * logo, the real product photo of every cap ordered, the Buy 3 Get 1 /
 * savings line when it applied, and the total.
 *
 * Satori needs explicit display:flex on any element with more than one child.
 */
export async function renderOrderCardPng(order: OrderForCard, items: ItemForCard[]): Promise<ArrayBuffer> {
  const brand = await getBrandProfile();
  const chapters = await getAllChapters().catch(() => []);
  const lines = items.slice(0, 4);

  const [logo, display, body, bodyBold, ...photos] = await Promise.all([
    imageDataUri("/images/brand/travaholic-logo-color-v2.png"),
    googleFont("Anton", 400),
    googleFont("Inter", 400),
    googleFont("Inter", 600),
    ...lines.map((item) => {
      const chapter = chapters.find((c) => c.slug === item.chapter_slug || c.name === item.chapter_name);
      return chapter ? imageDataUri(chapterImageSrc(chapter.folder, chapter.sideImage)) : Promise.resolve(null);
    }),
  ]);

  const orderNumber = order.id.slice(0, 8).toUpperCase();
  const firstName = String(order.customer_name ?? "").trim().split(/\s+/)[0];
  const capCount = items.reduce((s, i) => s + i.quantity, 0);
  const listTotal = items.reduce((s, i) => s + (i.unit_price ?? 0) * i.quantity, 0);
  const saved = listTotal > order.total ? listTotal - order.total : 0;
  const moreCount = items.length - lines.length;
  const tile = lines.length <= 2 ? 400 : lines.length === 3 ? 300 : 227;

  const fonts = [
    display && { name: "Display", data: display, weight: 400 as const, style: "normal" as const },
    body && { name: "Body", data: body, weight: 400 as const, style: "normal" as const },
    bodyBold && { name: "Body", data: bodyBold, weight: 600 as const, style: "normal" as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 400 | 600; style: "normal" }[];

  const image = new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", backgroundColor: CREAM, fontFamily: "Body" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", backgroundColor: INK, padding: "44px 56px", gap: 36 }}>
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} width={150} height={150} alt="" />
          )}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontFamily: "Display", fontSize: 72, color: CREAM, lineHeight: 1 }}>ORDER CONFIRMED</div>
            <div style={{ display: "flex", fontSize: 26, color: GOLD, marginTop: 14, letterSpacing: 1 }}>
              {`#${orderNumber}${firstName ? ` · Thank you, ${firstName}!` : ""}`}
            </div>
          </div>
        </div>

        {/* Caps */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 56px", flexGrow: 1 }}>
          <div style={{ display: "flex", fontSize: 20, color: MUTED, letterSpacing: 3, fontWeight: 600 }}>
            {`YOUR ${capCount} ${capCount === 1 ? "CAP" : "CAPS"}`}
          </div>
          <div style={{ display: "flex", gap: 20, marginTop: 20 }}>
            {lines.map((item, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", width: tile }}>
                <div style={{ display: "flex", width: tile, height: tile, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" }}>
                  {photos[i] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photos[i] as string} width={tile - 24} height={tile - 24} style={{ objectFit: "contain" }} alt="" />
                  ) : (
                    <div style={{ display: "flex", fontFamily: "Display", fontSize: 28, color: INK }}>{item.chapter_name}</div>
                  )}
                </div>
                <div style={{ display: "flex", fontSize: 22, color: INK, marginTop: 12, fontWeight: 600 }}>
                  {`${item.quantity > 1 ? `${item.quantity} × ` : ""}${item.chapter_name}`}
                </div>
              </div>
            ))}
          </div>
          {moreCount > 0 && (
            <div style={{ display: "flex", fontSize: 20, color: MUTED, marginTop: 12 }}>{`+ ${moreCount} more`}</div>
          )}
        </div>

        {/* Totals */}
        <div style={{ display: "flex", flexDirection: "column", padding: "0 56px 44px" }}>
          {saved > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: "#2a7a4f", fontWeight: 600, marginBottom: 14 }}>
              <div style={{ display: "flex" }}>{capCount >= 4 ? "Buy 3, Get 1 Free applied" : "Savings"}</div>
              <div style={{ display: "flex" }}>{`− ₹${saved.toLocaleString("en-IN")}`}</div>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "2px solid rgba(16,24,32,0.15)", paddingTop: 18 }}>
            <div style={{ display: "flex", fontFamily: "Display", fontSize: 44, color: INK }}>TOTAL PAID</div>
            <div style={{ display: "flex", fontFamily: "Display", fontSize: 56, color: INK }}>{`₹${order.total.toLocaleString("en-IN")}`}</div>
          </div>
          <div style={{ display: "flex", fontSize: 20, color: MUTED, marginTop: 14 }}>
            {`Free shipping · We'll send your tracking link when it ships · ${brand.siteUrl.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}`}
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1080, fonts: fonts.length ? fonts : undefined }
  );

  return image.arrayBuffer();
}

/**
 * Renders and uploads the card, returning its public URL — used as the
 * WhatsApp order-confirmation template's header image. Reuses the
 * ad-creatives Storage bucket (already public) under its own prefix rather
 * than provisioning a new bucket for one more image type.
 */
export async function generateAndUploadOrderCard(order: OrderForCard, items: ItemForCard[]) {
  const png = await renderOrderCardPng(order, items);
  const supabase = getSupabaseServerClient();
  const path = `order-cards/${order.id}.png`;

  const { error } = await supabase.storage
    .from("ad-creatives")
    .upload(path, png, { contentType: "image/png", upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from("ad-creatives").getPublicUrl(path);
  return data.publicUrl;
}
