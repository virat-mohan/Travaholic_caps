"use client";

import { useEffect, useState } from "react";

type Draft = {
  id: string;
  topic: string;
  title: string | null;
  subtitle: string | null;
  category: string | null;
  excerpt: string | null;
  body: string[] | null;
  status: string;
  created_at: string;
};

export default function JournalDraftsPage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [topic, setTopic] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function loadDrafts() {
    fetch("/api/admin/journal-drafts")
      .then((res) => res.json())
      .then((data) => setDrafts(data.drafts ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(loadDrafts, []);

  async function generate() {
    if (!topic.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/journal-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not generate draft");
      setDrafts((prev) => [data.draft, ...prev]);
      setTopic("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate draft");
    } finally {
      setGenerating(false);
    }
  }

  async function setStatus(id: string, status: string) {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, status } : d)));
    await fetch("/api/admin/journal-drafts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
  }

  return (
    <main className="mx-auto w-full max-w-[900px] px-6 pt-28 pb-24 md:px-12">
      <h1 className="mt-2 font-display text-heading-l uppercase text-ink">Journal Draft Generator</h1>
      <p className="mt-2 max-w-lg text-body-s text-secondary-text">
        Type a topic, Claude drafts a full article in Travaholic&apos;s voice. Drafts are saved here
        for review — they don&apos;t publish to the live Journal automatically; copy an approved
        draft into <code>lib/journal.ts</code> as a new article once it&apos;s ready.
      </p>

      <div className="mt-8 border-t border-divider pt-6">
        <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
          Topic
        </label>
        <div className="mt-3 flex gap-3">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. a monsoon weekend trip to Goa"
            className="flex-1 border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s text-ink outline-none focus:border-ink"
          />
          <button
            onClick={generate}
            disabled={generating || !topic.trim()}
            className="border border-ink px-5 py-2 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink transition-colors duration-300 hover:bg-ink hover:text-cream disabled:opacity-50"
          >
            {generating ? "Generating..." : "Generate Draft"}
          </button>
        </div>
        {error && <p className="mt-3 text-body-s text-paint-orange">{error}</p>}
      </div>

      <div className="mt-12 space-y-8">
        {loading ? (
          <p className="text-body-s text-secondary-text">Loading...</p>
        ) : drafts.length === 0 ? (
          <p className="text-body-s text-secondary-text">No drafts yet.</p>
        ) : (
          drafts.map((d) => (
            <div key={d.id} className="border-t border-divider pt-6">
              <div className="flex items-center justify-between gap-4">
                <p className="text-caption uppercase tracking-[0.1em] text-secondary-text">
                  {d.category ?? "Uncategorised"} · from topic &ldquo;{d.topic}&rdquo;
                </p>
                <select
                  value={d.status}
                  onChange={(e) => setStatus(d.id, e.target.value)}
                  className="border border-divider bg-surface px-2 py-1 font-sans text-caption text-ink"
                >
                  <option value="draft">Draft</option>
                  <option value="ready">Ready To Publish</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <h2 className="mt-2 font-display text-heading-s uppercase text-ink">{d.title}</h2>
              <p className="mt-1 text-body-s text-secondary-text">{d.subtitle}</p>
              <div className="mt-4 space-y-3">
                {(d.body ?? []).map((p, i) =>
                  p.startsWith("> ") ? (
                    <blockquote key={i} className="border-l-2 border-ink pl-4 text-body-s italic text-ink">
                      {p.slice(2)}
                    </blockquote>
                  ) : (
                    <p key={i} className="text-body-s leading-relaxed text-ink">
                      {p}
                    </p>
                  )
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
