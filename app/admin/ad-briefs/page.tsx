"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { chapters } from "@/lib/chapters";

type Brief = {
  id: string;
  chapter_slug: string | null;
  headline: string;
  primary_text: string;
  cta: string;
  target_audience: string;
  image_prompt: string;
  image_url: string | null;
  image_source: string | null;
  video_status: string | null;
  video_url: string | null;
  status: string;
  meta_campaign_id: string | null;
  created_at: string;
};

type Asset = { id: string; url: string; label: string | null; tags: string[] };

export default function AdBriefsPage() {
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [loading, setLoading] = useState(true);
  const [chapterSlug, setChapterSlug] = useState(chapters[0]?.slug ?? "");
  const [customInstructions, setCustomInstructions] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [pickerForId, setPickerForId] = useState<string | null>(null);
  const [budgets, setBudgets] = useState<Record<string, number>>({});

  function loadBriefs() {
    fetch("/api/admin/ad-briefs")
      .then((res) => res.json())
      .then((data) => setBriefs(data.briefs ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(loadBriefs, []);
  useEffect(() => {
    fetch("/api/admin/marketing-assets")
      .then((res) => res.json())
      .then((data) => setAssets(data.assets ?? []));
  }, []);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ad-briefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterSlug, customInstructions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not generate brief");
      setBriefs((prev) => [data.brief, ...prev]);
      setCustomInstructions("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate brief");
    } finally {
      setGenerating(false);
    }
  }

  async function generateImage(brief: Brief) {
    setError(null);
    try {
      const res = await fetch("/api/admin/ad-briefs/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: brief.id, imagePrompt: brief.image_prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not generate image");
      setBriefs((prev) =>
        prev.map((b) => (b.id === brief.id ? { ...b, image_url: data.imageUrl, image_source: "generated" } : b))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate image");
    }
  }

  async function generateVideo(brief: Brief) {
    setError(null);
    setBriefs((prev) => prev.map((b) => (b.id === brief.id ? { ...b, video_status: "generating" } : b)));
    try {
      const res = await fetch("/api/admin/ad-briefs/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: brief.id, imagePrompt: brief.image_prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start video generation");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start video generation");
      setBriefs((prev) => prev.map((b) => (b.id === brief.id ? { ...b, video_status: "failed" } : b)));
    }
  }

  async function checkVideoStatus(brief: Brief) {
    setError(null);
    try {
      const res = await fetch("/api/admin/ad-briefs/video-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: brief.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not check video status");
      if (data.status === "ready") {
        setBriefs((prev) =>
          prev.map((b) => (b.id === brief.id ? { ...b, video_status: "ready", video_url: data.videoUrl } : b))
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check video status");
    }
  }

  async function attachAsset(briefId: string, url: string) {
    await fetch("/api/admin/ad-briefs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: briefId, imageUrl: url, imageSource: "real" }),
    });
    setBriefs((prev) => prev.map((b) => (b.id === briefId ? { ...b, image_url: url, image_source: "real" } : b)));
    setPickerForId(null);
  }

  async function launch(brief: Brief) {
    setError(null);
    try {
      const res = await fetch("/api/admin/ad-briefs/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: brief.id, dailyBudgetRupees: budgets[brief.id] ?? 500 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not launch campaign");
      setBriefs((prev) =>
        prev.map((b) => (b.id === brief.id ? { ...b, status: "launched", meta_campaign_id: data.campaignId } : b))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not launch campaign");
    }
  }

  return (
    <main className="mx-auto w-full max-w-[900px] px-6 pt-28 pb-24 md:px-12">
      <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">
        Internal — not linked in navigation
      </p>
      <h1 className="mt-2 font-display text-heading-l uppercase text-ink">Ad Brief Generator</h1>
      <p className="mt-2 max-w-lg text-body-s text-secondary-text">
        Claude drafts ad copy from recent sales, you attach a real photo or generate one, then
        launch — every campaign is created PAUSED on Meta. Nothing goes live until you switch it
        on yourself in Meta Ads Manager.
      </p>

      <div className="mt-8 border-t border-divider pt-6">
        <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
          Chapter
        </label>
        <select
          value={chapterSlug}
          onChange={(e) => setChapterSlug(e.target.value)}
          className="mt-3 w-full border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s text-ink outline-none focus:border-ink"
        >
          {chapters.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>

        <label className="mt-4 block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
          Custom Direction (optional)
        </label>
        <p className="mt-1 text-micro text-secondary-text/70">
          Override the default strategy — e.g. &ldquo;focus on the monsoon angle&rdquo; or
          &ldquo;target gifting, not the wearer directly.&rdquo;
        </p>
        <textarea
          rows={2}
          value={customInstructions}
          onChange={(e) => setCustomInstructions(e.target.value)}
          className="mt-2 w-full border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s text-ink outline-none focus:border-ink"
        />

        <button
          onClick={generate}
          disabled={generating}
          className="mt-4 border border-ink px-5 py-2 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink transition-colors duration-300 hover:bg-ink hover:text-cream disabled:opacity-50"
        >
          {generating ? "Generating..." : "Generate Ad Brief"}
        </button>
        {error && <p className="mt-3 text-body-s text-paint-orange">{error}</p>}
      </div>

      <div className="mt-12 space-y-10">
        {loading ? (
          <p className="text-body-s text-secondary-text">Loading...</p>
        ) : briefs.length === 0 ? (
          <p className="text-body-s text-secondary-text">No briefs yet.</p>
        ) : (
          briefs.map((brief) => (
            <div key={brief.id} className="border-t border-divider pt-6">
              <div className="flex items-center justify-between gap-4">
                <p className="text-caption uppercase tracking-[0.1em] text-secondary-text">
                  {chapters.find((c) => c.slug === brief.chapter_slug)?.name ?? brief.chapter_slug}
                </p>
                <span className="text-micro uppercase tracking-[0.05em] text-tan-gold">
                  {brief.status}
                </span>
              </div>

              <div className="mt-4 grid gap-6 md:grid-cols-[200px_1fr]">
                <div>
                  {brief.image_url ? (
                    <div className="relative aspect-square overflow-hidden bg-surface-alt">
                      <Image src={brief.image_url} alt={brief.headline} fill sizes="200px" className="object-cover" />
                    </div>
                  ) : (
                    <div className="flex aspect-square items-center justify-center bg-surface-alt text-micro text-secondary-text">
                      No image yet
                    </div>
                  )}
                  <div className="mt-2 space-y-1.5">
                    <button
                      onClick={() => generateImage(brief)}
                      className="block w-full border border-ink px-2 py-1.5 text-micro uppercase tracking-[0.05em] text-ink hover:bg-ink hover:text-cream"
                    >
                      Generate With AI
                    </button>
                    <button
                      onClick={() => setPickerForId(pickerForId === brief.id ? null : brief.id)}
                      className="block w-full border border-divider px-2 py-1.5 text-micro uppercase tracking-[0.05em] text-ink hover:border-ink"
                    >
                      Use Real Photo
                    </button>
                  </div>
                  {pickerForId === brief.id && (
                    <div className="mt-2 grid max-h-64 grid-cols-3 gap-1.5 overflow-y-auto border border-divider p-2">
                      {assets.map((a) => (
                        <button key={a.id} onClick={() => attachAsset(brief.id, a.url)} className="relative aspect-square">
                          <Image src={a.url} alt={a.label ?? ""} fill sizes="80px" className="object-cover" />
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 border-t border-divider pt-3">
                    <p className="mb-1.5 text-micro uppercase tracking-[0.05em] text-secondary-text">
                      Reel (Veo)
                    </p>
                    {brief.video_status === "ready" && brief.video_url ? (
                      <video src={brief.video_url} controls className="w-full bg-surface-alt" />
                    ) : brief.video_status === "generating" ? (
                      <button
                        onClick={() => checkVideoStatus(brief)}
                        className="block w-full border border-divider px-2 py-1.5 text-micro uppercase tracking-[0.05em] text-ink hover:border-ink"
                      >
                        Check Status
                      </button>
                    ) : (
                      <button
                        onClick={() => generateVideo(brief)}
                        disabled={!brief.image_prompt}
                        className="block w-full border border-ink px-2 py-1.5 text-micro uppercase tracking-[0.05em] text-ink hover:bg-ink hover:text-cream disabled:opacity-50"
                      >
                        {brief.video_status === "failed" ? "Retry Generation" : "Generate Reel"}
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <h2 className="font-display text-heading-s uppercase text-ink">{brief.headline}</h2>
                  <p className="mt-2 text-body-s text-ink">{brief.primary_text}</p>
                  <p className="mt-3 text-caption text-secondary-text">CTA: {brief.cta}</p>
                  <p className="mt-1 text-caption text-secondary-text">
                    Audience: {brief.target_audience}
                  </p>

                  {brief.status !== "launched" && (
                    <div className="mt-4 flex items-center gap-3">
                      <label className="text-caption text-secondary-text">Daily budget ₹</label>
                      <input
                        type="number"
                        defaultValue={500}
                        onChange={(e) =>
                          setBudgets((prev) => ({ ...prev, [brief.id]: Number(e.target.value) }))
                        }
                        className="w-20 border border-divider bg-surface px-2 py-1 text-body-s text-ink"
                      />
                      <button
                        onClick={() => launch(brief)}
                        disabled={!brief.image_url}
                        className="border border-ink bg-ink px-4 py-1.5 font-sans text-caption font-bold uppercase tracking-[0.05em] text-cream disabled:opacity-40"
                      >
                        Launch (Paused)
                      </button>
                    </div>
                  )}
                  {brief.status === "launched" && (
                    <p className="mt-4 text-caption text-tan-gold">
                      Created on Meta as PAUSED — campaign {brief.meta_campaign_id}. Open Meta Ads
                      Manager to review and activate.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
