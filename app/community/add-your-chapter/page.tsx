"use client";

import { useState } from "react";
import Link from "next/link";
import { NewsletterBlock } from "@/components/newsletter/NewsletterBlock";
import { FooterEditorial } from "@/components/footer/FooterEditorial";

export default function AddYourChapterPage() {
  const [photo, setPhoto] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!photo) {
      setError("Please add a photo.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const form = e.currentTarget;
    const formData = new FormData();
    formData.append("photo", photo);
    formData.append("testimonial", (form.elements.namedItem("story") as HTMLTextAreaElement).value);
    formData.append("location", (form.elements.namedItem("location") as HTMLInputElement).value);
    formData.append("email", (form.elements.namedItem("email") as HTMLInputElement).value);

    try {
      const res = await fetch("/api/community/submit", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Could not submit");
      setSubmitted(true);
    } catch {
      setError("Something went wrong sending that — mind trying again?");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <main className="mx-auto w-full max-w-[760px] px-6 pt-32 pb-24 md:px-12 md:pt-40">
        <Link
          href="/community"
          className="text-caption uppercase tracking-[0.1em] text-secondary-text hover:text-ink"
        >
          ← Explorers
        </Link>

        <p className="mt-6 text-caption uppercase tracking-[0.15em] text-secondary-text">
          Add Your Chapter
        </p>
        <h1 className="mt-2 font-display text-heading-xl uppercase leading-[0.95] text-ink md:text-display-m">
          Your Trip Is A Chapter Too.
        </h1>
        <p className="mt-4 max-w-md text-body text-secondary-text">
          Send a photo of you wearing Travaholic out in the world, tell us where it was taken and
          why it mattered, and get 25% off your next Chapter. If we feature it, it goes up on the
          Explorers wall — and eventually out to our socials.
        </p>

        {submitted ? (
          <div className="mt-16 border-t border-divider pt-10">
            <p className="font-display text-heading-m uppercase text-ink">You&apos;re In.</p>
            <p className="mt-3 max-w-md text-body text-secondary-text">
              Thanks for sending that over. We read every submission by hand — if it fits, your
              25% code lands in your inbox within a few days, and your photo makes its way to the
              Explorers wall.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-14 space-y-8">
            <div>
              <label
                htmlFor="photo"
                className="block cursor-pointer border border-dashed border-ink/30 px-6 py-12 text-center transition-colors hover:border-ink"
              >
                <span className="block font-sans text-body-s uppercase tracking-[0.1em] text-ink">
                  {photo?.name ?? "Upload Your Photo"}
                </span>
                <span className="mt-2 block text-caption text-secondary-text">
                  JPG or PNG, one photo per submission
                </span>
                <input
                  id="photo"
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            <div>
              <label
                htmlFor="story"
                className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text"
              >
                Where was this, and what were you doing?
              </label>
              <textarea
                id="story"
                name="story"
                required
                rows={5}
                placeholder="e.g. Somewhere above 4,000m in Spiti, three days off signal, still wearing it."
                className="mt-3 w-full border border-ink/30 bg-surface px-5 py-4 font-sans text-body text-ink outline-none placeholder:text-secondary-text focus:border-ink"
              />
            </div>

            <div>
              <label
                htmlFor="location"
                className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text"
              >
                Where was this taken?
              </label>
              <input
                id="location"
                name="location"
                type="text"
                placeholder="e.g. Spiti Valley, Himachal Pradesh"
                className="mt-3 w-full border border-ink/30 bg-surface px-5 py-3 font-sans text-body-s text-ink outline-none placeholder:text-secondary-text focus:border-ink"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text"
              >
                Email — for your 25% code
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="you@email.com"
                className="mt-3 w-full border border-ink/30 bg-surface px-5 py-3 font-sans text-body-s text-ink outline-none placeholder:text-secondary-text focus:border-ink"
              />
            </div>

            {error && <p className="text-body-s text-paint-orange">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="border border-ink bg-ink px-8 py-3 font-sans text-body-s font-bold uppercase tracking-[0.1em] text-cream transition-colors duration-300 hover:bg-cream hover:text-ink disabled:opacity-60"
            >
              {submitting ? "Sending..." : "Submit Your Chapter"}
            </button>
          </form>
        )}
      </main>

      <NewsletterBlock />
      <FooterEditorial />
    </>
  );
}
