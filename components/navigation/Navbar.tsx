"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ShoppingBag, Menu, X } from "lucide-react";
import { seriesOrder } from "@/lib/series";
import { useCart } from "@/lib/cart";

const links = [
  { label: "Series", href: "/series" },
  { label: "Explorers", href: "/community" },
  { label: "Journal", href: "/journal" },
  { label: "About", href: "/about" },
];

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { count } = useCart();

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
          <button
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((v) => !v)}
            className="text-cream"
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
        <div className="absolute inset-x-0 top-full border-b border-[var(--color-divider)] bg-near-black">
          <div className="mx-auto grid w-full max-w-[1440px] grid-cols-2 gap-10 px-6 py-10 md:grid-cols-4 md:px-12">
            <div>
              <p className="mb-4 text-caption uppercase tracking-[0.1em] text-cream/50">
                Chapters
              </p>
              <ul className="space-y-3">
                {seriesOrder.map((s) => (
                  <li key={s.slug}>
                    <Link
                      href={`/series/${s.slug}`}
                      onClick={() => setMenuOpen(false)}
                      className="font-sans text-body-s text-cream/85 transition-colors hover:text-cream"
                    >
                      {s.name}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link
                    href="/series"
                    onClick={() => setMenuOpen(false)}
                    className="font-sans text-body-s text-cream/85 underline underline-offset-4 transition-colors hover:text-cream"
                  >
                    All Series
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <p className="mb-4 text-caption uppercase tracking-[0.1em] text-cream/50">
                Travaholic
              </p>
              <ul className="space-y-3">
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
        </div>
      )}
    </header>
  );
}
