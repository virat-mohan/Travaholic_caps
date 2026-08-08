export function NewsletterBlock() {
  return (
    <section className="border-t border-divider py-20 text-center">
      <p className="font-display text-heading-l uppercase text-ink md:text-heading-xl">
        Keep Exploring.
      </p>
      <p className="mx-auto mt-3 max-w-md font-sans text-body-s text-secondary-text">
        Receive new Chapters, travel stories and exclusive drops before everyone else.
      </p>
      <form className="mx-auto mt-8 flex max-w-md items-center gap-3 px-6">
        <input
          type="email"
          placeholder="YOUR EMAIL"
          className="w-full border border-ink/30 bg-surface px-5 py-3 font-sans text-body-s uppercase tracking-[0.05em] text-ink outline-none placeholder:text-secondary-text focus:border-ink"
        />
        <button
          type="submit"
          className="whitespace-nowrap border border-ink bg-ink px-6 py-3 font-sans text-body-s font-bold uppercase tracking-[0.1em] text-cream transition-colors duration-300 hover:bg-cream hover:text-ink"
        >
          Join
        </button>
      </form>
    </section>
  );
}
