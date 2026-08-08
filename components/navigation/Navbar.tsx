import Link from "next/link";
import Image from "next/image";
import { Search, ShoppingBag, Menu } from "lucide-react";

const links = [
  { label: "Series", href: "/series" },
  { label: "Journal", href: "/journal" },
  { label: "Explorers", href: "/community" },
  { label: "About", href: "/about" },
];

export function Navbar() {
  return (
    <header className="sticky inset-x-0 top-0 z-50 border-b border-[var(--color-divider)] bg-near-black">
      <nav className="relative mx-auto flex h-20 w-full max-w-[1440px] items-center justify-between px-6 md:h-28 md:px-12">
        <div className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-sans text-micro uppercase tracking-[0.15em] text-cream/80 transition-colors hover:text-cream"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <Link
          href="/"
          className="absolute left-1/2 top-full z-10 -translate-x-1/2 -translate-y-[62%]"
        >
          <Image
            src="/images/brand/travaholic-logo-color-v2.png"
            alt="Travaholic"
            width={340}
            height={340}
            style={{ height: "120px", width: "auto" }}
            className="drop-shadow-[0_4px_16px_rgba(0,0,0,0.35)] md:!h-[170px]"
            priority
          />
        </Link>

        <div className="flex items-center gap-5">
          <button aria-label="Search" className="text-cream">
            <Search size={18} strokeWidth={1.5} />
          </button>
          <button aria-label="Cart" className="text-cream">
            <ShoppingBag size={18} strokeWidth={1.5} />
          </button>
          <button aria-label="Menu" className="text-cream md:hidden">
            <Menu size={20} strokeWidth={1.5} />
          </button>
        </div>
      </nav>
    </header>
  );
}
