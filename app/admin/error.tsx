"use client";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="px-4 py-16 md:px-10">
      <div className="mx-auto max-w-md rounded-2xl border border-divider bg-surface p-8 text-center">
        <p className="text-body font-medium text-ink">This page didn’t load.</p>
        <p className="mt-2 text-body-s text-secondary-text">
          Nothing was changed. It’s usually a brief connection issue — try again.
        </p>
        {error.digest && <p className="mt-2 text-micro text-secondary-text">Ref: {error.digest}</p>}
        <button type="button" onClick={reset} className="mt-6 rounded-full bg-ink px-5 py-2.5 text-body-s text-surface">
          Try again
        </button>
      </div>
    </div>
  );
}
