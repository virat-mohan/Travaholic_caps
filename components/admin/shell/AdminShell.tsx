"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV_SECTIONS, TAB_LINKS, findCurrent } from "@/components/admin/shell/nav";
import { CommandPalette } from "@/components/admin/shell/CommandPalette";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);

  // Close the phone menu whenever the route changes.
  if (openedAt !== pathname) {
    setOpenedAt(pathname);
    setMenuOpen(false);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (pathname === "/admin/login") return <div className="admin-shell min-h-screen bg-background">{children}</div>;

  const current = findCurrent(pathname);
  const isActive = (href: string) => current?.link.href === href;

  const nav = (
    <nav aria-label="Admin">
      {NAV_SECTIONS.map((section) => (
        <div key={section.label} className="mb-6">
          <p className="mb-2 flex items-center gap-2 px-3 text-micro uppercase tracking-[0.12em] text-secondary-text">
            <span aria-hidden className={`admin-dot admin-dot-${section.accent}`} />
            {section.label}
          </p>
          <ul className="space-y-0.5">
            {section.links.map((link) => (
              <li key={section.label + link.href}>
                <Link
                  href={link.href}
                  aria-current={isActive(link.href) ? "page" : undefined}
                  className={`admin-navlink block rounded-lg px-3 py-1.5 text-body-s ${
                    isActive(link.href) ? "bg-surface-alt font-medium text-ink" : "text-secondary-text hover:bg-surface-alt hover:text-ink"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  const searchButton = (
    <button
      type="button"
      onClick={() => setPaletteOpen(true)}
      className="flex w-full items-center justify-between rounded-lg border border-divider bg-background px-3 py-2 text-body-s text-secondary-text hover:text-ink"
    >
      <span>Jump to…</span>
      <kbd className="rounded border border-divider px-1.5 text-micro">⌘K</kbd>
    </button>
  );

  return (
    <div className="admin-shell flex min-h-screen w-full bg-background text-ink">
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col overflow-y-auto border-r border-divider bg-surface px-4 pt-7 pb-10 md:flex">
        <Link href="/admin/orders" className="mb-5 px-3 text-micro uppercase tracking-[0.18em] text-secondary-text">
          Admin
        </Link>
        <div className="mb-6">{searchButton}</div>
        {nav}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
        <header className="admin-topbar sticky top-0 z-30 bg-background/90 px-4 py-3 backdrop-blur md:px-10 md:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              {current && (
                <p className="truncate text-micro uppercase tracking-[0.12em] text-secondary-text">
                  Admin <span aria-hidden>›</span> {current.section.label}
                  {current.link.href !== pathname && (
                    <>
                      {" "}<span aria-hidden>›</span>{" "}
                      <Link href={current.link.href} className="hover:text-ink">{current.link.label}</Link>
                    </>
                  )}
                </p>
              )}
              <h1 className="admin-title truncate text-ink">{current?.link.label ?? "Admin"}</h1>
            </div>
            <span className="admin-brand hidden shrink-0 md:block">Travaholic</span>
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Search admin pages"
              className="shrink-0 rounded-full border border-divider px-3 py-1.5 text-body-s text-secondary-text md:hidden"
            >
              Search
            </button>
          </div>
        </header>
        <main className="admin-main admin-fade min-w-0 flex-1">{children}</main>
        <footer className="admin-signature border-t px-4 py-6 md:px-10">
          <a href="https://viratmohan.com/mission" target="_blank" rel="noopener noreferrer">
            Virat Mohan · I build the machine that gets good products to the world. →
          </a>
        </footer>
      </div>

      {/* Phone bottom tabs */}
      <nav
        aria-label="Admin quick tabs"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-divider bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {TAB_LINKS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={isActive(t.href) ? "page" : undefined}
            className={`py-3 text-center text-micro ${isActive(t.href) ? "font-medium text-ink" : "text-secondary-text"}`}
          >
            {t.label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="py-3 text-center text-micro text-secondary-text"
          aria-expanded={menuOpen}
        >
          More
        </button>
      </nav>

      {menuOpen && (
        <div className="admin-fade fixed inset-0 z-50 bg-overlay md:hidden" onMouseDown={(e) => e.target === e.currentTarget && setMenuOpen(false)}>
          <div className="admin-rise absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-surface px-4 pt-5 pb-10">
            <div className="mb-5 flex items-center justify-between px-3">
              <p className="text-body font-medium">All pages</p>
              <button type="button" onClick={() => setMenuOpen(false)} className="text-body-s text-secondary-text">Close</button>
            </div>
            <div className="mb-6">{searchButton}</div>
            {nav}
          </div>
        </div>
      )}

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
