import { getSetting } from "@/lib/settings";
import { getSupabaseServerClient } from "@/lib/supabase";

/**
 * Single entry point for turning an ad-brief image prompt into a stored,
 * publicly-hosted image. The provider is swappable — Gemini ("nano banana")
 * is the default for its price and, more importantly, its image-to-image
 * editing: it can take a real product photo and composite it into a scene
 * instead of hallucinating a new product. Add a case below for another
 * provider (OpenAI, Flux, Ideogram) without touching any of the callers.
 */
export async function generateAdImage(options: {
  prompt: string;
  referenceImageUrl?: string;
  storagePathPrefix: string;
}): Promise<string> {
  const apiKey = await getSetting("IMAGE_GEN_API_KEY");
  if (!apiKey) {
    throw new Error("IMAGE_GEN_API_KEY is not set — add a Gemini API key in /admin/settings");
  }

  const base64Png = await generateWithGemini(apiKey, options.prompt, options.referenceImageUrl);
  return uploadGeneratedImage(base64Png, options.storagePathPrefix);
}

async function generateWithGemini(apiKey: string, prompt: string, referenceImageUrl?: string) {
  const parts: Record<string, unknown>[] = [{ text: prompt }];

  if (referenceImageUrl) {
    const refRes = await fetch(referenceImageUrl);
    if (refRes.ok) {
      const buffer = await refRes.arrayBuffer();
      const mimeType = refRes.headers.get("content-type") ?? "image/png";
      parts.push({
        inlineData: { mimeType, data: Buffer.from(buffer).toString("base64") },
      });
    }
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }] }),
    }
  );

  if (!res.ok) {
    throw new Error(`Gemini image generation failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const imagePart = data.candidates?.[0]?.content?.parts?.find(
    (p: { inlineData?: { data?: string } }) => p.inlineData?.data
  );
  if (!imagePart) throw new Error("Gemini response did not contain an image");
  return imagePart.inlineData.data as string;
}

async function uploadGeneratedImage(base64Png: string, storagePathPrefix: string) {
  const supabase = getSupabaseServerClient();
  const path = `${storagePathPrefix}/${crypto.randomUUID()}.png`;
  const buffer = Buffer.from(base64Png, "base64");

  const { error } = await supabase.storage
    .from("ad-creatives")
    .upload(path, buffer, { contentType: "image/png", upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from("ad-creatives").getPublicUrl(path);
  return data.publicUrl;
}
