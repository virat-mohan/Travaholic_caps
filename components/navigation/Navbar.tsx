"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ShoppingBag, Menu, X } from "lucide-react";
import { WhatsAppIcon } from "@/components/contact/WhatsAppIcon";
import { SearchOverlay } from "@/components/navigation/SearchOverlay";
import { useCart } from "@/lib/cart";

// Always visible on desktop — kept to shop-path links only. Journal and
// Travel Inspiration are content, not a purchase path, so they moved to the
// menu dropdown and the footer instead of competing for space in the bar.
const leftLinks = [{ label: "Story Series", href: "/series" }];

const rightLinks = [
  { label: "Explorers", href: "/community" },
  { label: "My Story", href: "/about" },
];

// Full set shown in the menu dropdown (mobile always, desktop via the
// hamburger) — includes the content links demoted out of the desktop bar.
const links = [
  ...leftLinks,
  { label: "Travel Inspiration", href: "/travel-inspiration" },
  ...rightLinks,
  { label: "Journal", href: "/journal" },
];

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);
  const { count } = useCart();

  useEffect(() => {
    lastScrollY.current = window.scrollY;
    function onScroll() {
      const y = window.scrollY;
      const scrollingDown = y > lastScrollY.current;
      setHidden(scrollingDown && y > 120);
      lastScrollY.current = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky inset-x-0 top-0 z-50 border-b border-[var(--color-divider)] bg-near-black transition-transform duration-300 ${
        hidden && !menuOpen ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      <nav className="relative mx-auto flex h-20 w-full max-w-[1440px] items-center justify-between px-6 md:h-28 md:px-12">
        <div className="flex items-center gap-8">
          <button
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((v) => !v)}
            className="text-cream md:hidden"
          >
            {menuOpen ? <X size={20} strokeWidth={1.5} /> : <Menu size={20} strokeWidth={1.5} />}
          </button>
          <div className="hidden items-center gap-8 md:flex">
            {leftLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-sans text-micro uppercase tracking-[0.15em] text-cream/80 transition-colors hover:text-cream"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <Link
          href="/"
          className={`absolute left-1/2 top-full z-10 -translate-x-1/2 transition-transform duration-300 ${
            hidden && !menuOpen ? "-translate-y-[400%]" : "-translate-y-[54%]"
          }`}
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

        <div className="flex items-center gap-6">
          <div className="hidden items-center gap-8 md:flex">
            {rightLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-sans text-micro uppercase tracking-[0.15em] text-cream/80 transition-colors hover:text-cream"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <SearchOverlay />
          <a
            href="https://wa.me/918800339125"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Contact us on WhatsApp"
            className="hidden items-center gap-1.5 text-cream/80 transition-colors hover:text-cream md:flex"
          >
            <WhatsAppIcon size={16} />
            <span className="font-sans text-micro uppercase tracking-[0.1em]">Contact</span>
          </a>
          <a
            href="https://wa.me/918800339125"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Contact us on WhatsApp"
            className="text-cream md:hidden"
          >
            <WhatsAppIcon size={22} />
          </a>
          <button
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((v) => !v)}
            className="hidden text-cream md:block"
          >
            {menuOpen ? <X size={20} strokeWidth={1.5} /> : <Menu size={20} strokeWidth={1.5} />}
          </button>
          <Link aria-label="Cart" href="/cart" className="relative text-cream">
            <ShoppingBag size={18} strokeWidth={1.5} />
            {count > 0 && (
              <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-tan-gold text-[10px] font-bold text-ink">
                {count}
              </span>
            )}
          </Link>
        </div>
      </nav>

      {menuOpen && (
        <div className="absolute inset-x-0 top-full max-h-[calc(100vh-5rem)] overflow-y-auto border-b border-[var(--color-divider)] bg-near-black">
          <div className="mx-auto w-full max-w-[1440px] px-6 py-10 md:px-12">
            <ul className="space-y-4">
              {links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="font-sans text-body-s text-cream/85 transition-colors hover:text-cream"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </header>
  );
}
