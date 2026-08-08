import Link from "next/link";

const columns = [
  {
    title: "Brand",
    links: [
      { label: "About", href: "/about" },
      { label: "Journal", href: "/journal" },
      { label: "Community", href: "/community" },
    ],
  },
  {
    title: "Series",
    links: [
      { label: "Summer Escape", href: "/series/summer-escape" },
      { label: "Into The Wild", href: "/series/into-the-wild" },
      { label: "Blue Horizon", href: "/series/blue-horizon" },
    ],
  },
  {
    title: "Contact",
    links: [
      { label: "+91-9958871283", href: "https://wa.me/919958871283" },
      { label: "iamtravoholic@gmail.com", href: "mailto:iamtravoholic@gmail.com" },
      { label: "Instagram", href: "https://instagram.com/travaholiccaps" },
      { label: "Facebook", href: "https://facebook.com/profile.php?id=100080234022161" },
    ],
  },
];

export function FooterEditorial() {
  return (
    <footer className="border-t border-divider bg-cream py-16">
      <div className="mx-auto grid w-full max-w-[1440px] grid-cols-2 gap-10 px-6 font-sans md:grid-cols-5 md:px-12">
        <div className="col-span-2">
          <p className="font-display text-heading-s uppercase text-ink">Travaholic</p>
          <p className="mt-3 max-w-xs text-caption text-secondary-text">
            Stories you can wear. Premium trucker caps inspired by journeys, landscapes and
            moments worth remembering.
          </p>
          <p className="mt-4 max-w-xs text-micro uppercase tracking-[0.05em] text-secondary-text">
            C-152, Okhla Industrial Area Phase-1, Delhi, South Delhi, 110025
          </p>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">
              {col.title}
            </p>
            <ul className="mt-4 space-y-2">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-body-s uppercase tracking-[0.02em] text-ink hover:text-secondary-text"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-12 flex w-full max-w-[1440px] items-center justify-between px-6 font-sans text-micro uppercase tracking-[0.05em] text-secondary-text md:px-12">
        <p>© {new Date().getFullYear()} Travaholic</p>
        <div className="flex gap-5">
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-ink">
            Terms
          </Link>
        </div>
      </div>

      <p
        aria-hidden
        className="font-display mt-10 select-none overflow-hidden whitespace-nowrap text-center uppercase leading-[0.8] text-ink"
        style={{ fontSize: "clamp(3.5rem, 14vw, 12rem)" }}
      >
        Travaholic
      </p>
    </footer>
  );
}
