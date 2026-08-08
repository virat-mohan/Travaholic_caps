import Link from "next/link";
import Image from "next/image";
import { Search, ShoppingBag, Menu } from "lucide-react";

const links = [
  { label: "Series", href: "/series" },
  { label: "Journal", href: "/journal" },
  { label: "About", href: "/about" },
];

export function Navbar() {
  return (
    <header className="sticky inset-x-0 top-0 z-50 border-b border-[var(--color-divider)] bg-near-black">
      <nav className="relative mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between px-6 md:h-20 md:px-12">
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
          className="flex items-center gap-2 md:absolute md:left-1/2 md:-translate-x-1/2"
        >
          <Image
            src="/images/brand/Travaholic logo.png"
            alt=""
            width={20}
            height={20}
            style={{ filter: "invert(1)" }}
          />
          <span className="font-display text-body-l uppercase text-cream">Travaholic</span>
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
