"use client";

import Link from "next/link";
import { Search, ShoppingBag, Menu } from "lucide-react";
import { useEffect, useState } from "react";

const links = [
  { label: "Series", href: "/series" },
  { label: "Journal", href: "/journal" },
  { label: "About", href: "/about" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-warm-white/90 shadow-[0_1px_0_0_var(--color-divider)] backdrop-blur-md"
          : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between px-6 md:h-20 md:px-12">
        <Link
          href="/"
          className={`font-display text-body-l tracking-[0.02em] transition-colors duration-500 ${
            scrolled ? "text-charcoal" : "text-white"
          }`}
        >
          TRAVAHOLIC
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-body-s transition-colors duration-500 ${
                scrolled ? "text-charcoal hover:text-secondary-text" : "text-white/90 hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-5">
          <button
            aria-label="Search"
            className={`transition-colors duration-500 ${scrolled ? "text-charcoal" : "text-white"}`}
          >
            <Search size={19} strokeWidth={1.5} />
          </button>
          <button
            aria-label="Cart"
            className={`transition-colors duration-500 ${scrolled ? "text-charcoal" : "text-white"}`}
          >
            <ShoppingBag size={19} strokeWidth={1.5} />
          </button>
          <button
            aria-label="Menu"
            className={`md:hidden transition-colors duration-500 ${scrolled ? "text-charcoal" : "text-white"}`}
          >
            <Menu size={20} strokeWidth={1.5} />
          </button>
        </div>
      </nav>
    </header>
  );
}
