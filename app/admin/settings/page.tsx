"use client";

import { useEffect, useState } from "react";

const FIELDS: { key: string; label: string; hint: string }[] = [
  { key: "RAZORPAY_KEY_ID", label: "Razorpay Key ID", hint: "Test or live Key ID from Razorpay → Settings → API Keys." },
  { key: "RAZORPAY_KEY_SECRET", label: "Razorpay Key Secret", hint: "Paired secret for the Key ID above." },
  { key: "RESEND_API_KEY", label: "Resend API Key", hint: "For emailing invoices/order confirmations." },
  { key: "INTERAKT_API_KEY", label: "Interakt API Key", hint: "For automatic WhatsApp order confirmations." },
  { key: "ANTHROPIC_API_KEY", label: "Anthropic API Key", hint: "Powers Claude-generated Journal drafts and, later, the marketing intelligence layer." },
  { key: "META_ACCESS_TOKEN", label: "Meta Access Token", hint: "From Meta Business Manager, for the ad account below." },
  { key: "META_AD_ACCOUNT_ID", label: "Meta Ad Account ID", hint: "e.g. act_1234567890" },
];

export default function AdminSettingsPage() {
  const [present, setPresent] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => res.json())
      .then((data) => setPresent(data.present ?? {}))
      .finally(() => setLoading(false));
  }, []);

  async function save(key: string) {
    const value = drafts[key];
    if (!value) return;
    await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    setPresent((prev) => ({ ...prev, [key]: true }));
    setDrafts((prev) => ({ ...prev, [key]: "" }));
    setSavedKey(key);
  }

  return (
    <main className="mx-auto w-full max-w-[800px] px-6 pt-28 pb-24 md:px-12">
      <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">
        Internal — not linked in navigation
      </p>
      <h1 className="mt-2 font-display text-heading-l uppercase text-ink">API Keys & Settings</h1>
      <p className="mt-2 max-w-lg text-body-s text-secondary-text">
        Stored server-side in Supabase, never sent to the browser. Add a key any time — features
        that depend on it switch on automatically once it&apos;s here.
      </p>

      {loading ? (
        <p className="mt-8 text-body-s text-secondary-text">Loading...</p>
      ) : (
        <div className="mt-10 space-y-8">
          {FIELDS.map((f) => (
            <div key={f.key} className="border-t border-divider pt-6">
              <div className="flex items-center gap-3">
                <p className="font-sans text-body-s uppercase tracking-[0.03em] text-ink">
                  {f.label}
                </p>
                <span
                  className={`text-micro uppercase tracking-[0.05em] ${
                    present[f.key] ? "text-tan-gold" : "text-secondary-text"
                  }`}
                >
                  {present[f.key] ? "● Configured" : "○ Not set"}
                </span>
              </div>
              <p className="mt-1 text-caption text-secondary-text">{f.hint}</p>
              <div className="mt-3 flex gap-3">
                <input
                  type="password"
                  placeholder={present[f.key] ? "Enter a new value to replace it" : "Paste value here"}
                  value={drafts[f.key] ?? ""}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  className="flex-1 border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s text-ink outline-none focus:border-ink"
                />
                <button
                  onClick={() => save(f.key)}
                  className="border border-ink px-5 py-2 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink transition-colors duration-300 hover:bg-ink hover:text-cream"
                >
                  {savedKey === f.key ? "Saved ✓" : "Save"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
