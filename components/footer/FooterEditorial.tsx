import Link from "next/link";
import Image from "next/image";
import { brand } from "@/lib/retail-os-brand";

const columns = [
  {
    title: "Brand",
    links: [
      { label: "My Story", href: "/about" },
      { label: "Journal", href: "/journal" },
      { label: "Explorers", href: "/community" },
      { label: "Travel Inspiration", href: "/travel-inspiration" },
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
      { label: "Contact Us", href: "/contact" },
      { label: brand.contact.whatsappLabel, href: brand.contact.whatsappHref },
      { label: brand.contact.email, href: `mailto:${brand.contact.email}` },
      { label: "Instagram", href: brand.social.instagram },
      { label: "Facebook", href: brand.social.facebook },
    ],
  },
];

export function FooterEditorial() {
  return (
    <footer className="border-t border-divider bg-cream py-16">
      <div className="mx-auto grid w-full max-w-[1440px] grid-cols-2 gap-10 px-6 font-sans md:grid-cols-5 md:px-12">
        <div className="col-span-2">
          <p className="font-display text-heading-s uppercase text-ink">{brand.profile.brandName}</p>
          <p className="mt-3 max-w-xs text-caption text-secondary-text">
            {brand.footerBlurb}
          </p>
          <p className="mt-4 max-w-xs text-micro uppercase tracking-[0.05em] text-secondary-text">
            {brand.address.full}
          </p>
          <p className="mt-1 max-w-xs text-micro uppercase tracking-[0.05em] text-secondary-text">
            {brand.gstin}
          </p>
          <p className="mt-4 max-w-xs text-micro uppercase tracking-[0.05em] text-secondary-text">
            Built by{" "}
            <a
              href="https://viratmohan.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-ink"
            >
              Virat Mohan
            </a>
            {" "}— Powering Businesses With AI
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
        <p>© {new Date().getFullYear()} {brand.profile.brandName}</p>
        <div className="flex flex-wrap gap-5">
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-ink">
            Terms
          </Link>
          <Link href="/refund-policy" className="hover:text-ink">
            Refunds
          </Link>
          <Link href="/shipping-policy" className="hover:text-ink">
            Shipping
          </Link>
        </div>
      </div>

      <div aria-hidden className="mt-10 flex w-full justify-center overflow-hidden px-6">
        <Image
          src={brand.assets.footerWordmarkPath}
          alt=""
          width={1200}
          height={130}
          className="h-auto w-full max-w-[900px]"
        />
      </div>
    </footer>
  );
}
