// Package-driven dashboard navigation for Travaholic.
//
// The canonical dashboard/navigation authority is @retail-os/brand-config.
// This module resolves the BrandConfig into the NavSection[] shape that
// AdminShell.tsx consumes. nav.ts is no longer the independent authority;
// all section structure, ordering and visibility come from the package.
//
// Route links are Travaholic-specific (each brand has its own pages).
// The package tells us WHICH sections exist and which are visible;
// this module tells us WHAT links each section contains for Travaholic.

import {
  buildDashboardSections,
  type DashboardSection,
  type DashboardSectionView,
} from "@retail-os/brand-config/dashboard-sections";
import { resolveModuleStatus, type SetupProbe } from "@retail-os/brand-config/module-status";
import { travaholicConfig } from "@/lib/brand-config";

export type NavLink = { href: string; label: string };
export type Accent = "terracotta" | "cobalt" | "magenta" | "gold" | "bronze";
export type NavSection = {
  label: string;
  accent: Accent;
  links: NavLink[];
  canonicalSection: string;
};

const SECTION_ACCENTS: Record<DashboardSection, Accent> = {
  command_centre: "gold",
  brand: "bronze",
  catalogue: "terracotta",
  commerce: "terracotta",
  growth: "cobalt",
  inventory_master: "bronze",
  finance: "gold",
  operations: "magenta",
  team_partners: "bronze",
  reports: "cobalt",
  settings: "bronze",
};

const SECTION_LINKS: Record<DashboardSection, NavLink[]> = {
  command_centre: [],
  brand: [
    { href: "/admin/brand-profile", label: "Brand Profile" },
  ],
  catalogue: [
    { href: "/admin/edit-chapter", label: "Edit Chapters" },
    { href: "/admin/add-chapter", label: "Add Chapter" },
    { href: "/admin/marketing-assets", label: "Marketing Assets" },
  ],
  commerce: [
    { href: "/admin/orders", label: "Orders" },
    { href: "/admin/orders/new", label: "Add Manual Order" },
    { href: "/admin/post-barter", label: "Pay With A Post" },
    { href: "/admin/returns", label: "Return Requests" },
    { href: "/admin/discounts", label: "Discount Rules" },
    { href: "/admin/coupons", label: "Coupon Codes" },
  ],
  growth: [
    { href: "/admin/analytics", label: "Website Analytics" },
    { href: "/admin/ux-insights", label: "UX Insights (Clarity)" },
    { href: "/admin/ad-briefs", label: "Ad Brief Generator" },
    { href: "/admin/content-calendar", label: "Content Calendar" },
    { href: "/admin/reports", label: "Growth Reports" },
    { href: "/admin/abandoned-carts", label: "Abandoned Carts" },
    { href: "/admin/email-campaigns", label: "Email Campaigns" },
    { href: "/admin/performance", label: "Performance Manager" },
    { href: "/admin/agent-log", label: "Ad Agent" },
    { href: "/admin/journal-drafts", label: "Journal Draft Generator" },
    { href: "/admin/newsletter", label: "Newsletter" },
    { href: "/admin/whatsapp", label: "WhatsApp Inbox" },
    { href: "/admin/customers", label: "Customers & Miles" },
    { href: "/admin/leads", label: "Leads" },
    { href: "/admin/explorer-submissions", label: "Explorer Submissions" },
    { href: "/admin/reviews", label: "Reviews" },
  ],
  inventory_master: [
    { href: "/admin/inventory", label: "Inventory" },
  ],
  finance: [
    { href: "/admin/pnl", label: "P&L" },
    { href: "/admin/business-plan", label: "Business Plan" },
    { href: "/admin/expenses", label: "Expenses" },
  ],
  operations: [
    { href: "/admin/logistics", label: "Shipments & RTO" },
  ],
  team_partners: [],
  reports: [],
  settings: [
    { href: "/admin/settings", label: "API Keys & Settings" },
  ],
};

const noopProbe: SetupProbe = { hasSetting: () => true };

function resolveNavSections(): NavSection[] {
  const statuses = resolveModuleStatus(travaholicConfig, noopProbe);
  const sections = buildDashboardSections(travaholicConfig, statuses);

  return sections
    .filter((s: DashboardSectionView) => {
      const links = SECTION_LINKS[s.section] ?? [];
      return s.visible || links.length > 0;
    })
    .map((s: DashboardSectionView) => ({
      label: s.label,
      accent: SECTION_ACCENTS[s.section],
      links: SECTION_LINKS[s.section] ?? [],
      canonicalSection: s.section,
    }));
}

export const NAV_SECTIONS: NavSection[] = resolveNavSections();

export const TAB_LINKS: NavLink[] = [
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/logistics", label: "Shipping" },
  { href: "/admin/pnl", label: "Finance" },
];

export function findCurrent(pathname: string) {
  let best: { section: NavSection; link: NavLink } | null = null;
  for (const section of NAV_SECTIONS) {
    for (const link of section.links) {
      if (pathname === link.href || pathname.startsWith(link.href + "/")) {
        if (!best || link.href.length > best.link.href.length) best = { section, link };
      }
    }
  }
  return best;
}
