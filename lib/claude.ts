import { getSetting } from "@/lib/settings";

export type GeneratedJournalDraft = {
  title: string;
  subtitle: string;
  category: string;
  excerpt: string;
  body: string[];
};

const CATEGORIES = [
  "Road Trips",
  "Weekend Escapes",
  "Camping",
  "Coffee",
  "Photography",
  "Behind The Craft",
  "Design Notes",
  "Explorer Stories",
  "Travel Guides",
  "Playlists",
  "Packing Lists",
  "Collaborations",
];

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Claude response did not contain JSON");
  return raw.slice(start, end + 1);
}

export async function generateJournalDraft(topic: string): Promise<GeneratedJournalDraft> {
  const apiKey = await getSetting("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set — add it in /admin/settings first");
  }

  const prompt = `You are writing a Journal article for Travaholic, a premium Indian trucker-cap brand ("Stories You Can Wear"). The brand voice is warm, specific, editorial — travel stories that happen to feature a cap, never a hard sell. Every article ties back to a real place or moment.

Topic: "${topic}"

Pick the single best-fitting category from this list: ${CATEGORIES.join(", ")}.

Return ONLY a JSON object, no commentary, in this exact shape:
{
  "title": "string, punchy, under 60 characters",
  "subtitle": "string, one line, names the category feel",
  "category": "one of the categories above, verbatim",
  "excerpt": "string, one or two sentences, under 200 characters",
  "body": ["paragraph 1", "paragraph 2", "> a pull-quote paragraph starting with '> '", "more paragraphs..."]
}

Write 4-6 paragraphs in "body", including exactly one pull-quote paragraph starting with "> ". Keep the tone specific and sensory, never generic travel-blog filler.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Claude API error: ${res.status} ${text}`);
  }

  const data = await res.json();
  // Sonnet 5 returns extended-thinking content first — content[0] is a
  // "thinking" block, not the text, so the actual JSON is wherever the
  // "text"-typed block ends up, never reliably at a fixed index.
  const text = data.content?.find((block: { type: string; text?: string }) => block.type === "text")?.text ?? "";
  const parsed = JSON.parse(extractJson(text));

  return {
    title: parsed.title,
    subtitle: parsed.subtitle,
    category: parsed.category,
    excerpt: parsed.excerpt,
    body: parsed.body,
  };
}
