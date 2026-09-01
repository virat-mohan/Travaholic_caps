"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { chapters } from "@/lib/chapters";

type Brief = {
  id: string;
  chapter_slug: string | null;
  chapter_slugs: string[] | null;
  headline: string;
  primary_text: string;
  cta: string;
  target_audience: string;
  hashtags: string[] | null;
  is_carousel: boolean;
  image_prompt: string | null;
  image_prompts: string[] | null;
  creative_style: string | null;
  overlay_text: string | null;
  posted_at: string | null;
  instagram_post_id: string | null;
  image_url: string | null;
  image_urls: (string | null)[] | null;
  image_source: string | null;
  video_status: string | null;
  video_url: string | null;
  status: string;
  meta_campaign_id: string | null;
  created_at: string;
  auto_generated: boolean;
  sales_signal: string | null;
  scheduled_for: string | null;
  scheduled_action: "post" | "launch" | null;
  queue_status: "none" | "queued" | "published" | "failed";
  queue_error: string | null;
  launched_at: string | null;
  ad_cta_override: string | null;
  ad_age_min: number;
  ad_age_max: number;
  ad_gender: "all" | "male" | "female";
  ad_daily_budget_rupees: number;
};

const CTA_OPTIONS = ["SHOP_NOW", "LEARN_MORE", "SIGN_UP", "GET_OFFER", "CONTACT_US"];

type Asset = { id: string; url: string; label: string | null; tags: string[] };

export default function AdBriefsPage() {
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [loading, setLoading] = useState(true);
  const [chapterSlug, setChapterSlug] = useState(chapters[0]?.slug ?? "");
  const [isGeneric, setIsGeneric] = useState(false);
  const [isCarousel, setIsCarousel] = useState(false);
  const [multiChapterMode, setMultiChapterMode] = useState(false);
  const [selectedChapterSlugs, setSelectedChapterSlugs] = useState<string[]>([]);
  const [customInstructions, setCustomInstructions] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [pickerForId, setPickerForId] = useState<string | null>(null);
  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [posting, setPosting] = useState<Record<string, boolean>>({});
  const [editInstructions, setEditInstructions] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [videoEditInstructions, setVideoEditInstructions] = useState<Record<string, string>>({});
  const [ctaOverrides, setCtaOverrides] = useState<Record<string, string>>({});
  const [ageMins, setAgeMins] = useState<Record<string, number>>({});
  const [ageMaxs, setAgeMaxs] = useState<Record<string, number>>({});
  const [genders, setGenders] = useState<Record<string, "all" | "male" | "female">>({});
  const [scheduleAt, setScheduleAt] = useState<Record<string, string>>({});
  const [scheduleAction, setScheduleAction] = useState<Record<string, "post" | "launch">>({});
  const [scheduling, setScheduling] = useState<Record<string, boolean>>({});
  const [imageGenerating, setImageGenerating] = useState<Record<string, boolean>>({});
  const [attaching, setAttaching] = useState<Record<string, boolean>>({});
  const [launching, setLaunching] = useState<Record<string, boolean>>({});
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  function loadBriefs() {
    fetch("/api/admin/ad-briefs")
      .then((res) => res.json())
      .then((data) => setBriefs(data.briefs ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(loadBriefs, []);
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxUrl(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
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
        body: JSON.stringify({
          chapterSlug: isGeneric || (isCarousel && multiChapterMode) ? undefined : chapterSlug,
          chapterSlugs: isCarousel && multiChapterMode ? selectedChapterSlugs : undefined,
          isGeneric: isCarousel && multiChapterMode ? false : isGeneric,
          isCarousel,
          customInstructions,
        }),
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
    setImageGenerating((prev) => ({ ...prev, [brief.id]: true }));
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
    } finally {
      setImageGenerating((prev) => ({ ...prev, [brief.id]: false }));
    }
  }

  async function generateSlotImage(brief: Brief, slotIndex: number) {
    const key = `${brief.id}:${slotIndex}`;
    setError(null);
    setImageGenerating((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetch("/api/admin/ad-briefs/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: brief.id, imagePrompt: brief.image_prompts?.[slotIndex], slotIndex }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not generate image");
      setBriefs((prev) =>
        prev.map((b) => {
          if (b.id !== brief.id) return b;
          const next = Array.isArray(b.image_urls) ? [...b.image_urls] : [];
          while (next.length < slotIndex + 1) next.push(null);
          next[slotIndex] = data.imageUrl;
          return { ...b, image_urls: next, image_source: "generated" };
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate image");
    } finally {
      setImageGenerating((prev) => ({ ...prev, [key]: false }));
    }
  }

  async function generateVideo(brief: Brief) {
    setError(null);
    setBriefs((prev) => prev.map((b) => (b.id === brief.id ? { ...b, video_status: "generating" } : b)));
    try {
      const res = await fetch("/api/admin/ad-briefs/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: brief.id,
          imagePrompt: brief.image_prompt,
          editInstruction: videoEditInstructions[brief.id] || undefined,
        }),
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

  async function editImage(brief: Brief, slotIndex?: number) {
    const key = slotIndex != null ? `${brief.id}:${slotIndex}` : brief.id;
    const instruction = editInstructions[key];
    if (!instruction) return;
    setError(null);
    setEditing((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetch("/api/admin/ad-briefs/edit-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: brief.id, editInstruction: instruction, slotIndex }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not edit image");
      setBriefs((prev) =>
        prev.map((b) => {
          if (b.id !== brief.id) return b;
          if (slotIndex == null) return { ...b, image_url: data.imageUrl, image_source: "generated" };
          const next = Array.isArray(b.image_urls) ? [...b.image_urls] : [];
          while (next.length < slotIndex + 1) next.push(null);
          next[slotIndex] = data.imageUrl;
          return { ...b, image_urls: next, image_source: "generated" };
        })
      );
      setEditInstructions((prev) => ({ ...prev, [key]: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not edit image");
    } finally {
      setEditing((prev) => ({ ...prev, [key]: false }));
    }
  }

  async function queueBrief(brief: Brief) {
    const scheduledFor = scheduleAt[brief.id];
    const action = scheduleAction[brief.id] ?? "post";
    if (!scheduledFor) return;
    setError(null);
    setScheduling((prev) => ({ ...prev, [brief.id]: true }));
    try {
      const res = await fetch("/api/admin/ad-briefs/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: brief.id,
          scheduledFor: new Date(scheduledFor).toISOString(),
          scheduledAction: action,
          dailyBudgetRupees: budgets[brief.id] ?? brief.ad_daily_budget_rupees ?? 500,
          cta: ctaOverrides[brief.id] || undefined,
          ageMin: ageMins[brief.id],
          ageMax: ageMaxs[brief.id],
          gender: genders[brief.id],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not queue brief");
      setBriefs((prev) =>
        prev.map((b) =>
          b.id === brief.id
            ? { ...b, scheduled_for: new Date(scheduledFor).toISOString(), scheduled_action: action, queue_status: "queued" }
            : b
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not queue brief");
    } finally {
      setScheduling((prev) => ({ ...prev, [brief.id]: false }));
    }
  }

  async function cancelQueue(brief: Brief) {
    setError(null);
    try {
      await fetch("/api/admin/ad-briefs/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: brief.id, cancel: true }),
      });
      setBriefs((prev) =>
        prev.map((b) =>
          b.id === brief.id ? { ...b, scheduled_for: null, scheduled_action: null, queue_status: "none" } : b
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel schedule");
    }
  }

  async function attachAsset(brief: Brief, url: string) {
    setError(null);
    setPickerForId(null);
    // The brief itself decided whether this ad wants a real photo with
    // bold on-image text or a plain attached photo — the picker just
    // supplies which real photo to use either way.
    if (brief.creative_style === "real_photo_text_overlay" && brief.overlay_text) {
      setAttaching((prev) => ({ ...prev, [brief.id]: true }));
      try {
        const res = await fetch("/api/admin/ad-briefs/composite-overlay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: brief.id, baseImageUrl: url }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not composite text overlay");
        setBriefs((prev) =>
          prev.map((b) => (b.id === brief.id ? { ...b, image_url: data.imageUrl, image_source: "real_with_text" } : b))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not composite text overlay");
      } finally {
        setAttaching((prev) => ({ ...prev, [brief.id]: false }));
      }
      return;
    }

    await fetch("/api/admin/ad-briefs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: brief.id, imageUrl: url, imageSource: "real" }),
    });
    setBriefs((prev) => prev.map((b) => (b.id === brief.id ? { ...b, image_url: url, image_source: "real" } : b)));
  }

  async function postNow(brief: Brief) {
    setError(null);
    setPosting((prev) => ({ ...prev, [brief.id]: true }));
    try {
      const res = await fetch("/api/admin/ad-briefs/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: brief.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not post to Instagram");
      setBriefs((prev) =>
        prev.map((b) =>
          b.id === brief.id ? { ...b, posted_at: new Date().toISOString(), instagram_post_id: data.postId } : b
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post to Instagram");
    } finally {
      setPosting((prev) => ({ ...prev, [brief.id]: false }));
    }
  }

  async function launch(brief: Brief) {
    setError(null);
    setLaunching((prev) => ({ ...prev, [brief.id]: true }));
    try {
      const res = await fetch("/api/admin/ad-briefs/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: brief.id,
          dailyBudgetRupees: budgets[brief.id] ?? 500,
          cta: ctaOverrides[brief.id] || undefined,
          ageMin: ageMins[brief.id],
          ageMax: ageMaxs[brief.id],
          gender: genders[brief.id],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not launch campaign");
      setBriefs((prev) =>
        prev.map((b) => (b.id === brief.id ? { ...b, status: "launched", meta_campaign_id: data.campaignId } : b))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not launch campaign");
    } finally {
      setLaunching((prev) => ({ ...prev, [brief.id]: false }));
    }
  }

  return (
    <main className="mx-auto w-full max-w-[900px] px-6 pt-28 pb-24 md:px-12">
      <h1 className="mt-2 font-display text-heading-l uppercase text-ink">Ad Brief Generator</h1>
      <p className="mt-2 max-w-lg text-body-s text-secondary-text">
        Claude drafts ad copy from recent sales, you attach a real photo or generate one, then
        launch — every campaign is created PAUSED on Meta. Nothing goes live until you switch it
        on yourself in Meta Ads Manager.
      </p>

      <div className="mt-8 border-t border-divider pt-6">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsGeneric(false)}
            className={`border px-3 py-1.5 text-caption uppercase tracking-[0.05em] ${
              !isGeneric ? "border-ink bg-ink text-cream" : "border-divider text-ink"
            }`}
          >
            Specific Chapter
          </button>
          <button
            type="button"
            onClick={() => setIsGeneric(true)}
            className={`border px-3 py-1.5 text-caption uppercase tracking-[0.05em] ${
              isGeneric ? "border-ink bg-ink text-cream" : "border-divider text-ink"
            }`}
          >
            Generic Brand Post
          </button>
        </div>

        <label className="mt-4 flex items-center gap-3">
          <input
            type="checkbox"
            checked={isCarousel}
            onChange={(e) => setIsCarousel(e.target.checked)}
            className="h-4 w-4 accent-ink"
          />
          <span className="font-sans text-body-s text-ink">
            Carousel (Claude picks how many cards it needs)
          </span>
        </label>

        {isGeneric ? (
          <p className="mt-3 text-micro text-secondary-text/70">
            Not tied to one product — the copy covers the brand as a whole, and the CTA links to
            the homepage instead of a Chapter page.
          </p>
        ) : isCarousel ? (
          <>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setMultiChapterMode(false)}
                className={`border px-3 py-1.5 text-caption uppercase tracking-[0.05em] ${
                  !multiChapterMode ? "border-ink bg-ink text-cream" : "border-divider text-ink"
                }`}
              >
                One Chapter, Multiple Angles
              </button>
              <button
                type="button"
                onClick={() => setMultiChapterMode(true)}
                className={`border px-3 py-1.5 text-caption uppercase tracking-[0.05em] ${
                  multiChapterMode ? "border-ink bg-ink text-cream" : "border-divider text-ink"
                }`}
              >
                One Card Per Chapter
              </button>
            </div>

            {multiChapterMode ? (
              <>
                <div className="mt-3 flex items-center justify-between">
                  <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
                    Chapters ({selectedChapterSlugs.length} selected)
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedChapterSlugs(
                        selectedChapterSlugs.length === chapters.length ? [] : chapters.map((c) => c.slug)
                      )
                    }
                    className="text-micro text-secondary-text underline"
                  >
                    {selectedChapterSlugs.length === chapters.length ? "Clear All" : "Select All"}
                  </button>
                </div>
                <div className="mt-2 grid max-h-56 grid-cols-2 gap-1.5 overflow-y-auto border border-divider p-2 md:grid-cols-3">
                  {chapters.map((c) => (
                    <label key={c.slug} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedChapterSlugs.includes(c.slug)}
                        onChange={(e) =>
                          setSelectedChapterSlugs((prev) =>
                            e.target.checked ? [...prev, c.slug] : prev.filter((s) => s !== c.slug)
                          )
                        }
                        className="h-3.5 w-3.5 accent-ink"
                      />
                      <span className="text-body-s text-ink">{c.name}</span>
                    </label>
                  ))}
                </div>
                {selectedChapterSlugs.length > 0 && selectedChapterSlugs.length < 2 && (
                  <p className="mt-1 text-micro text-paint-orange">Pick at least 2 chapters for a carousel.</p>
                )}
              </>
            ) : (
              <>
                <label className="mt-4 block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
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
              </>
            )}
          </>
        ) : (
          <>
            <label className="mt-4 block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
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
          </>
        )}

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
          disabled={generating || (isCarousel && multiChapterMode && selectedChapterSlugs.length < 2)}
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
                  {brief.chapter_slugs && brief.chapter_slugs.length > 0
                    ? brief.chapter_slugs
                        .map((s) => chapters.find((c) => c.slug === s)?.name ?? s)
                        .join(" · ")
                    : brief.chapter_slug
                      ? (chapters.find((c) => c.slug === brief.chapter_slug)?.name ?? brief.chapter_slug)
                      : "Generic — Brand"}
                </p>
                <span className="text-micro uppercase tracking-[0.05em] text-tan-gold">
                  {brief.status}
                </span>
              </div>

              <div className="mt-4 grid gap-6 md:grid-cols-[280px_1fr]">
                <div>
                  {brief.is_carousel ? (
                    <div className="w-[280px]">
                      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
                        {Array.from(
                          { length: Math.max(brief.image_prompts?.length ?? 0, brief.image_urls?.length ?? 0) },
                          (_, i) => i
                        ).map((i) => {
                          const url = brief.image_urls?.[i];
                          const slotKey = `${brief.id}:${i}`;
                          return (
                            <div key={i} className="w-[280px] shrink-0 snap-center">
                              <p className="mb-1 text-micro uppercase tracking-[0.05em] text-secondary-text">
                                Card {i + 1} of {Math.max(brief.image_prompts?.length ?? 0, brief.image_urls?.length ?? 0)}
                              </p>
                              {url ? (
                                <button
                                  type="button"
                                  onClick={() => setLightboxUrl(url)}
                                  className="relative block aspect-square w-full cursor-zoom-in overflow-hidden bg-surface-alt"
                                >
                                  <Image src={url} alt={`${brief.headline} — card ${i + 1}`} fill sizes="280px" className="object-cover" />
                                </button>
                              ) : (
                                <div className="flex aspect-square items-center justify-center bg-surface-alt text-micro text-secondary-text">
                                  {imageGenerating[slotKey] ? "Generating..." : `Card ${i + 1}`}
                                </div>
                              )}
                              <button
                                onClick={() => generateSlotImage(brief, i)}
                                disabled={!brief.image_prompts?.[i] || imageGenerating[slotKey]}
                                className="mt-1.5 block w-full border border-ink px-2 py-1.5 text-micro uppercase tracking-[0.05em] text-ink hover:bg-ink hover:text-cream disabled:opacity-40"
                              >
                                {imageGenerating[slotKey] ? "Generating..." : url ? "Regenerate" : "Generate"}
                              </button>
                              {url && (
                                <div className="mt-1.5 flex gap-1.5">
                                  <input
                                    type="text"
                                    placeholder="Edit instruction"
                                    value={editInstructions[`${brief.id}:${i}`] ?? ""}
                                    onChange={(e) =>
                                      setEditInstructions((prev) => ({ ...prev, [`${brief.id}:${i}`]: e.target.value }))
                                    }
                                    className="w-full min-w-0 border border-divider bg-surface px-2 py-1.5 text-micro text-ink"
                                  />
                                  <button
                                    onClick={() => editImage(brief, i)}
                                    disabled={!editInstructions[`${brief.id}:${i}`] || editing[`${brief.id}:${i}`]}
                                    className="shrink-0 border border-divider px-2 py-1.5 text-micro uppercase text-ink hover:border-ink disabled:opacity-40"
                                  >
                                    {editing[`${brief.id}:${i}`] ? "..." : "Confirm"}
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <p className="mt-1 text-micro text-secondary-text/70">← Scroll to see all cards →</p>
                    </div>
                  ) : (
                    <>
                      {brief.image_url ? (
                        <button
                          type="button"
                          onClick={() => setLightboxUrl(brief.image_url)}
                          className="relative block aspect-square w-full cursor-zoom-in overflow-hidden bg-surface-alt"
                        >
                          <Image src={brief.image_url} alt={brief.headline} fill sizes="280px" className="object-cover" />
                        </button>
                      ) : (
                        <div className="flex aspect-square items-center justify-center bg-surface-alt text-micro text-secondary-text">
                          No image yet
                        </div>
                      )}
                      <p className="mt-2 text-micro text-secondary-text/70">
                        {brief.creative_style === "real_photo_text_overlay"
                          ? `Recommended: real photo + "${brief.overlay_text}" overlay`
                          : "Recommended: AI-generated lifestyle photo"}
                      </p>
                      {attaching[brief.id] && (
                        <p className="mt-2 text-micro uppercase tracking-[0.05em] text-tan-gold">
                          Compositing text overlay onto photo...
                        </p>
                      )}
                      <div className="mt-2 space-y-1.5">
                        <button
                          onClick={() => generateImage(brief)}
                          disabled={imageGenerating[brief.id]}
                          className={`block w-full border px-2 py-1.5 text-micro uppercase tracking-[0.05em] hover:bg-ink hover:text-cream disabled:opacity-40 ${
                            brief.creative_style === "real_photo_text_overlay"
                              ? "border-divider text-ink hover:border-ink"
                              : "border-ink text-ink"
                          }`}
                        >
                          {imageGenerating[brief.id] ? "Generating..." : brief.image_url ? "Regenerate" : "Generate With AI"}
                        </button>
                        <button
                          onClick={() => setPickerForId(pickerForId === brief.id ? null : brief.id)}
                          disabled={attaching[brief.id]}
                          className={`block w-full border px-2 py-1.5 text-micro uppercase tracking-[0.05em] text-ink disabled:opacity-40 ${
                            brief.creative_style === "real_photo_text_overlay" ? "border-ink" : "border-divider hover:border-ink"
                          }`}
                        >
                          {brief.creative_style === "real_photo_text_overlay" ? "Use Real Photo (+ Text)" : "Use Real Photo"}
                        </button>
                        {brief.image_url && (
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              placeholder="Edit instruction — e.g. &quot;make the sky more orange&quot;"
                              value={editInstructions[brief.id] ?? ""}
                              onChange={(e) => setEditInstructions((prev) => ({ ...prev, [brief.id]: e.target.value }))}
                              className="w-full min-w-0 border border-divider bg-surface px-2 py-1.5 text-micro text-ink"
                            />
                            <button
                              onClick={() => editImage(brief)}
                              disabled={!editInstructions[brief.id] || editing[brief.id]}
                              className="shrink-0 border border-divider px-2 py-1.5 text-micro uppercase tracking-[0.05em] text-ink hover:border-ink disabled:opacity-40"
                            >
                              {editing[brief.id] ? "Regenerating..." : "Confirm"}
                            </button>
                          </div>
                        )}
                      </div>
                      {pickerForId === brief.id && (
                        <div className="mt-2 grid max-h-64 grid-cols-3 gap-1.5 overflow-y-auto border border-divider p-2">
                          {assets.map((a) => (
                            <button key={a.id} onClick={() => attachAsset(brief, a.url)} className="relative aspect-square">
                              <Image src={a.url} alt={a.label ?? ""} fill sizes="80px" className="object-cover" />
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  <div className="mt-4 border-t border-divider pt-3">
                    <p className="mb-1.5 text-micro uppercase tracking-[0.05em] text-secondary-text">
                      Reel (Veo)
                    </p>
                    {brief.video_status === "ready" && brief.video_url ? (
                      <video src={brief.video_url} controls className="w-full bg-surface-alt" />
                    ) : null}
                    {brief.video_status === "generating" ? (
                      <button
                        onClick={() => checkVideoStatus(brief)}
                        className="mt-2 block w-full border border-divider px-2 py-1.5 text-micro uppercase tracking-[0.05em] text-ink hover:border-ink"
                      >
                        Check Status
                      </button>
                    ) : (
                      <>
                        <input
                          type="text"
                          placeholder="Edit direction (optional) — e.g. &quot;slower pan, closer on the cap&quot;"
                          value={videoEditInstructions[brief.id] ?? ""}
                          onChange={(e) =>
                            setVideoEditInstructions((prev) => ({ ...prev, [brief.id]: e.target.value }))
                          }
                          className="mt-2 w-full border border-divider bg-surface px-2 py-1.5 text-micro text-ink"
                        />
                        <button
                          onClick={() => generateVideo(brief)}
                          disabled={!brief.image_prompt}
                          className="mt-1.5 block w-full border border-ink px-2 py-1.5 text-micro uppercase tracking-[0.05em] text-ink hover:bg-ink hover:text-cream disabled:opacity-50"
                        >
                          {brief.video_status === "ready"
                            ? "Regenerate Reel"
                            : brief.video_status === "failed"
                              ? "Retry Generation"
                              : "Generate Reel"}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  {brief.auto_generated && (
                    <span className="mb-2 inline-block border border-tan-gold px-2 py-1 text-micro uppercase tracking-[0.05em] text-tan-gold">
                      Auto-drafted — {brief.sales_signal === "selling_fast" ? "Selling Fast" : "Cooling Off"}
                    </span>
                  )}
                  <h2 className="font-display text-heading-s uppercase text-ink">{brief.headline}</h2>
                  <p className="mt-2 text-body-s text-ink">{brief.primary_text}</p>
                  <p className="mt-3 text-caption text-secondary-text">CTA: {brief.cta}</p>
                  <p className="mt-1 text-caption text-secondary-text">
                    Audience: {brief.target_audience}
                  </p>
                  {brief.hashtags && brief.hashtags.length > 0 && (
                    <p className="mt-2 text-caption text-secondary-text">
                      {brief.hashtags.map((h) => `#${h}`).join(" ")}
                    </p>
                  )}

                  <div className="mt-4">
                    {brief.posted_at ? (
                      <p className="text-caption text-tan-gold">
                        Posted to Instagram — {new Date(brief.posted_at).toLocaleString("en-IN", {
                          timeZone: "Asia/Kolkata",
                          day: "numeric",
                          month: "short",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    ) : (
                      <button
                        onClick={() => postNow(brief)}
                        disabled={
                          posting[brief.id] ||
                          (brief.is_carousel
                            ? (brief.image_urls ?? []).filter(Boolean).length <
                              Math.max(brief.image_prompts?.length ?? 0, 2)
                            : !brief.image_url)
                        }
                        className="border border-divider px-4 py-1.5 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink hover:border-ink disabled:opacity-40"
                      >
                        {posting[brief.id] ? "Posting..." : "Post Now (No Ad Spend)"}
                      </button>
                    )}
                  </div>

                  {brief.status !== "launched" && (
                    <div className="mt-4 border-t border-divider pt-3">
                      <p className="mb-2 text-micro uppercase tracking-[0.05em] text-secondary-text">
                        Ad Launch Attributes
                      </p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-4">
                        <label className="flex flex-col gap-1">
                          <span className="text-micro text-secondary-text">Daily budget ₹</span>
                          <input
                            type="number"
                            defaultValue={brief.ad_daily_budget_rupees ?? 500}
                            onChange={(e) => setBudgets((prev) => ({ ...prev, [brief.id]: Number(e.target.value) }))}
                            className="w-full border border-divider bg-surface px-2 py-1 text-body-s text-ink"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-micro text-secondary-text">CTA button</span>
                          <select
                            defaultValue={brief.ad_cta_override || brief.cta}
                            onChange={(e) => setCtaOverrides((prev) => ({ ...prev, [brief.id]: e.target.value }))}
                            className="w-full border border-divider bg-surface px-2 py-1 text-body-s text-ink"
                          >
                            {CTA_OPTIONS.map((c) => (
                              <option key={c} value={c}>
                                {c.replace(/_/g, " ")}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-micro text-secondary-text">Age range</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              defaultValue={brief.ad_age_min ?? 18}
                              onChange={(e) => setAgeMins((prev) => ({ ...prev, [brief.id]: Number(e.target.value) }))}
                              className="w-full min-w-0 border border-divider bg-surface px-2 py-1 text-body-s text-ink"
                            />
                            <span className="text-secondary-text">–</span>
                            <input
                              type="number"
                              defaultValue={brief.ad_age_max ?? 65}
                              onChange={(e) => setAgeMaxs((prev) => ({ ...prev, [brief.id]: Number(e.target.value) }))}
                              className="w-full min-w-0 border border-divider bg-surface px-2 py-1 text-body-s text-ink"
                            />
                          </div>
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-micro text-secondary-text">Gender</span>
                          <select
                            defaultValue={brief.ad_gender ?? "all"}
                            onChange={(e) =>
                              setGenders((prev) => ({ ...prev, [brief.id]: e.target.value as "all" | "male" | "female" }))
                            }
                            className="w-full border border-divider bg-surface px-2 py-1 text-body-s text-ink"
                          >
                            <option value="all">All</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                          </select>
                        </label>
                      </div>
                      <p className="mt-1.5 text-micro text-secondary-text/70">
                        Objective: Traffic (link clicks) · Placements: Automatic · Country: India — fixed for now.
                      </p>

                      <div className="mt-3 flex items-center gap-3">
                        <button
                          onClick={() => launch(brief)}
                          disabled={
                            launching[brief.id] ||
                            (brief.is_carousel
                              ? (brief.image_urls ?? []).filter(Boolean).length <
                                Math.max(brief.image_prompts?.length ?? 0, 2)
                              : !brief.image_url)
                          }
                          className="border border-ink bg-ink px-4 py-1.5 font-sans text-caption font-bold uppercase tracking-[0.05em] text-cream disabled:opacity-40"
                        >
                          {launching[brief.id] ? "Launching..." : "Launch Now (Paused)"}
                        </button>
                      </div>

                      <div className="mt-4 border-t border-divider pt-3">
                        <p className="mb-1.5 text-micro uppercase tracking-[0.05em] text-secondary-text">
                          Queue For Later
                        </p>
                        {brief.queue_status === "queued" ? (
                          <div className="flex flex-wrap items-center gap-3">
                            <p className="text-caption text-tan-gold">
                              Queued to {brief.scheduled_action === "launch" ? "launch" : "post"} —{" "}
                              {brief.scheduled_for &&
                                new Date(brief.scheduled_for).toLocaleString("en-IN", {
                                  timeZone: "Asia/Kolkata",
                                  day: "numeric",
                                  month: "short",
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                            </p>
                            <button
                              onClick={() => cancelQueue(brief)}
                              className="text-micro text-secondary-text underline"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="datetime-local"
                              value={scheduleAt[brief.id] ?? ""}
                              onChange={(e) => setScheduleAt((prev) => ({ ...prev, [brief.id]: e.target.value }))}
                              className="border border-divider bg-surface px-2 py-1 text-body-s text-ink"
                            />
                            <select
                              value={scheduleAction[brief.id] ?? "post"}
                              onChange={(e) =>
                                setScheduleAction((prev) => ({ ...prev, [brief.id]: e.target.value as "post" | "launch" }))
                              }
                              className="border border-divider bg-surface px-2 py-1 text-body-s text-ink"
                            >
                              <option value="post">Post To Instagram</option>
                              <option value="launch">Launch Ad (Paused)</option>
                            </select>
                            <button
                              onClick={() => queueBrief(brief)}
                              disabled={!scheduleAt[brief.id] || scheduling[brief.id]}
                              className="border border-divider px-3 py-1.5 text-micro uppercase tracking-[0.05em] text-ink hover:border-ink disabled:opacity-40"
                            >
                              {scheduling[brief.id] ? "Queuing..." : "Queue"}
                            </button>
                            {brief.queue_status === "failed" && (
                              <p className="w-full text-micro text-paint-orange">
                                Last attempt failed: {brief.queue_error}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
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

      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/90 p-6"
        >
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className="absolute right-6 top-6 border border-cream/40 px-3 py-1.5 text-caption uppercase tracking-[0.05em] text-cream hover:border-cream"
          >
            Close ✕
          </button>
          <img
            src={lightboxUrl}
            alt=""
            className="max-h-full max-w-full object-contain"
          />
        </div>
      )}
    </main>
  );
}
