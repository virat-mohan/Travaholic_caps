import { getSetting } from "@/lib/settings";
import { getBrandProfile } from "@/lib/brand";
import type { ChapterSales } from "@/lib/sales-metrics";

export type AdBrief = {
  headline: string;
  primaryText: string;
  cta: string;
  targetAudience: string;
  imagePrompt: string;
};

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Claude response did not contain JSON");
  return raw.slice(start, end + 1);
}

export async function generateAdBrief(
  chapterName: string,
  sales?: ChapterSales,
  customInstructions?: string
): Promise<AdBrief> {
  const apiKey = await getSetting("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set — add it in /admin/settings first");

  const brand = await getBrandProfile();

  const salesLine = sales
    ? `It sold ${sales.unitsSold} units and ₹${sales.revenue.toLocaleString("en-IN")} in revenue over the last 30 days — lean into "selling fast" energy if that number is strong.`
    : "No recent sales data is available for this product yet — write for cold-audience discovery instead of urgency.";

  const overrideLine = customInstructions
    ? `\nThe admin has given this specific direction for this brief — follow it, even if it overrides the default strategy above: "${customInstructions}"`
    : "";

  const prompt = `You are writing a Meta (Instagram/Facebook) ad brief for ${brand.brandName} ("${brand.tagline}"), a D2C brand selling a ${brand.productNoun}.

Brand voice: ${brand.voice}

Product being promoted: "${chapterName}".
${salesLine}${overrideLine}

Return ONLY a JSON object, no commentary, in this exact shape:
{
  "headline": "string, under 40 characters, punchy",
  "primaryText": "string, 1-3 sentences, the actual ad body copy",
  "cta": "one of: SHOP_NOW, LEARN_MORE, SIGN_UP",
  "targetAudience": "one line describing who this ad should target (interests/demographics), for setting up Meta ad targeting",
  "imagePrompt": "a detailed visual scene description for an image generator — describe the setting, lighting, mood and how the product should be worn/used. Do not describe any on-image text, headline or logo — the image should be a clean lifestyle photo with no text baked in."
}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Claude API error: ${res.status} ${await res.text()}`);

  const data = await res.json();
  const text = data.content?.[0]?.text ?? "";
  const parsed = JSON.parse(extractJson(text));

  return {
    headline: parsed.headline,
    primaryText: parsed.primaryText,
    cta: parsed.cta,
    targetAudience: parsed.targetAudience,
    imagePrompt: parsed.imagePrompt,
  };
}
