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
    title: "Support",
    links: [
      { label: "Shipping", href: "/shipping" },
      { label: "Returns", href: "/returns" },
      { label: "Contact", href: "/contact" },
    ],
  },
];

export function FooterEditorial() {
  return (
    <footer className="border-t border-divider py-16">
      <div className="mx-auto grid w-full max-w-[1440px] grid-cols-2 gap-10 px-6 md:grid-cols-5 md:px-12">
        <div className="col-span-2">
          <p className="font-display text-heading-s text-charcoal">TRAVAHOLIC</p>
          <p className="mt-3 max-w-xs text-caption text-secondary-text">
            Stories you can wear. Premium trucker caps inspired by journeys, landscapes and
            moments worth remembering.
          </p>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <p className="text-caption uppercase tracking-[0.08em] text-secondary-text">
              {col.title}
            </p>
            <ul className="mt-4 space-y-2">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-body-s text-charcoal hover:text-secondary-text"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-12 flex w-full max-w-[1440px] items-center justify-between px-6 text-micro text-secondary-text md:px-12">
        <p>© {new Date().getFullYear()} Travaholic</p>
        <div className="flex gap-5">
          <Link href="/privacy" className="hover:text-charcoal">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-charcoal">
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}
