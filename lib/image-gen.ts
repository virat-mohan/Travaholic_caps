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
  const geminiKey = await getSetting("IMAGE_GEN_API_KEY");
  const openaiKey = await getSetting("OPENAI_API_KEY");

  let base64Png: string;
  if (geminiKey) {
    try {
      base64Png = await generateWithGemini(geminiKey, options.prompt, options.referenceImageUrl);
    } catch (err) {
      if (!openaiKey) throw err;
      base64Png = await generateWithOpenAI(openaiKey, options.prompt);
    }
  } else if (openaiKey) {
    base64Png = await generateWithOpenAI(openaiKey, options.prompt);
  } else {
    throw new Error(
      "Neither IMAGE_GEN_API_KEY (Gemini) nor OPENAI_API_KEY is set — add one in /admin/settings"
    );
  }

  return uploadGeneratedImage(base64Png, options.storagePathPrefix);
}

async function generateWithOpenAI(apiKey: string, prompt: string) {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI image generation failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const b64 = data.data?.[0]?.b64_json as string | undefined;
  if (!b64) throw new Error("OpenAI response did not contain an image");
  return b64;
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
