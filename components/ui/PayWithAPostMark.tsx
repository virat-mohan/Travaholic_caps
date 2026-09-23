import Link from "next/link";

/**
 * The one consistent way "Pay With A Post" ever renders in customer-facing
 * copy — gold-accented and set in the site's display face regardless of
 * surrounding text color/size, with a trademark mark, so it reads as a named
 * feature rather than a plain description. Swap every literal "Pay With A
 * Post" string in JSX for this instead of typing the phrase directly. Always
 * carries a little horizontal breathing room (mx-[0.15em]) so it never sits
 * flush against neighboring words.
 *
 * `linked` makes the whole mark a real link straight to the homepage's
 * "Pay With A Post" section (the actual explainer, not a cramped tooltip) —
 * only safe in non-interactive contexts (headings, standalone copy), never
 * inside an existing <button> or <Link>, since a nested <a> is invalid HTML
 * and breaks the outer control's click target.
 */
export function PayWithAPostMark({
  className = "",
  linked = false,
}: {
  className?: string;
  linked?: boolean;
}) {
  const mark = (
    <span className="relative inline-flex items-baseline whitespace-nowrap font-display text-[0.95em] normal-case tracking-[0.01em] text-tan-gold">
      <span className="bg-[linear-gradient(var(--color-tan-gold),var(--color-tan-gold))] bg-[length:100%_2px] bg-no-repeat bg-[position:0_100%] pb-[0.12em]">
        Pay With A Post
      </span>
      <sup className="ml-1 -translate-y-px font-sans text-[0.55em] font-bold tracking-normal">™</sup>
    </span>
  );

  if (linked) {
    return (
      <Link
        href="/#pay-with-a-post"
        title="See how Pay With A Post works"
        className={`mx-[0.15em] inline-flex items-baseline whitespace-nowrap opacity-100 transition-opacity duration-150 hover:opacity-75 ${className}`}
      >
        {mark}
      </Link>
    );
  }

  return <span className={`mx-[0.15em] inline-flex items-baseline whitespace-nowrap ${className}`}>{mark}</span>;
}
