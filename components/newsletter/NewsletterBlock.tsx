export function NewsletterBlock() {
  return (
    <section className="border-t border-divider py-20 text-center">
      <p className="font-display text-heading-l text-charcoal md:text-heading-xl">
        Keep Exploring.
      </p>
      <p className="mx-auto mt-3 max-w-md text-body-s text-secondary-text">
        Receive new Chapters, travel stories and exclusive drops before everyone else.
      </p>
      <form className="mx-auto mt-8 flex max-w-md items-center gap-3 px-6">
        <input
          type="email"
          placeholder="Your email"
          className="w-full rounded-pill border border-divider bg-surface px-5 py-3 text-body-s text-charcoal outline-none focus:border-charcoal"
        />
        <button
          type="submit"
          className="whitespace-nowrap rounded-pill bg-charcoal px-6 py-3 text-body-s text-white transition-transform duration-300 hover:scale-[1.02]"
        >
          Join The Journey
        </button>
      </form>
    </section>
  );
}
