import { ImageResponse } from "next/og";
import { getSupabaseServerClient } from "@/lib/supabase";

/**
 * Composites bold on-image text over a real product photo, for the
 * "real_photo_text_overlay" creative style the ad-brief generator picks —
 * a promotional graphic (real photo + a short punchy line), as opposed to
 * a clean AI-generated lifestyle shot with no text baked in. Same Satori/
 * ImageResponse technique as lib/order-card.tsx's WhatsApp card, including
 * fetching the source image ourselves and inlining it as a data URI —
 * Satori's own remote-image fetching has proven unreliable here.
 */
export async function renderTextOverlayImage(baseImageUrl: string, overlayText: string): Promise<ArrayBuffer> {
  const imgRes = await fetch(baseImageUrl);
  if (!imgRes.ok) throw new Error(`Could not fetch base image: ${imgRes.status}`);
  const imgBuffer = await imgRes.arrayBuffer();
  const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
  const dataUri = `data:${contentType};base64,${Buffer.from(imgBuffer).toString("base64")}`;

  const image = new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          position: "relative",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={dataUri}
          width={1080}
          height={1080}
          style={{ objectFit: "cover", position: "absolute", top: 0, left: 0 }}
          alt=""
        />
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: "45%",
            background: "linear-gradient(to top, rgba(0,0,0,0.75), rgba(0,0,0,0))",
          }}
        />
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: "56px",
            right: "56px",
            bottom: "64px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 72,
              fontWeight: 800,
              color: "#ffffff",
              lineHeight: 1.1,
              letterSpacing: -1,
              textShadow: "0 2px 24px rgba(0,0,0,0.4)",
            }}
          >
            {overlayText}
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1080 }
  );

  return image.arrayBuffer();
}

/** Renders and uploads the composited creative, returning its public URL. */
export async function generateAndUploadTextOverlayImage(
  briefId: string,
  baseImageUrl: string,
  overlayText: string
) {
  const png = await renderTextOverlayImage(baseImageUrl, overlayText);
  const supabase = getSupabaseServerClient();
  const path = `text-overlay/${briefId}-${Date.now()}.png`;

  const { error } = await supabase.storage
    .from("ad-creatives")
    .upload(path, png, { contentType: "image/png", upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from("ad-creatives").getPublicUrl(path);
  return data.publicUrl;
}
