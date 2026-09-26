export type NavLink = { href: string; label: string };
export type Accent = "terracotta" | "cobalt" | "magenta" | "gold" | "bronze";
export type NavSection = { label: string; accent: Accent; links: NavLink[] };

export const NAV_SECTIONS: NavSection[] = [
  { label: "Store", accent: "terracotta", links: [
    { href: "/admin/orders", label: "Orders" },
    { href: "/admin/orders/new", label: "Add Manual Order" },
    { href: "/admin/post-barter", label: "Pay With A Post" },
  ] },
  { label: "Marketing", accent: "cobalt", links: [
    { href: "/admin/analytics", label: "Website Analytics" },
    { href: "/admin/ux-insights", label: "UX Insights (Clarity)" },
    { href: "/admin/ad-briefs", label: "Ad Brief Generator" },
    { href: "/admin/content-calendar", label: "Content Calendar" },
    { href: "/admin/reports", label: "Growth Reports" },
    { href: "/admin/abandoned-carts", label: "Abandoned Carts" },
    { href: "/admin/performance", label: "Performance Manager" },
    { href: "/admin/agent-log", label: "Ad Agent" },
  ] },
  { label: "Logistics", accent: "magenta", links: [
    { href: "/admin/logistics", label: "Shipments & RTO" },
    { href: "/admin/returns", label: "Return Requests" },
  ] },
  { label: "Content", accent: "gold", links: [
    { href: "/admin/journal-drafts", label: "Journal Draft Generator" },
    { href: "/admin/newsletter", label: "Newsletter" },
  ] },
  { label: "Customers", accent: "bronze", links: [
    { href: "/admin/customers", label: "Customers & Miles" },
    { href: "/admin/leads", label: "Leads" },
  ] },
  { label: "Community", accent: "magenta", links: [
    { href: "/admin/explorer-submissions", label: "Explorer Submissions" },
    { href: "/admin/reviews", label: "Reviews" },
  ] },
  { label: "Finance", accent: "gold", links: [
    { href: "/admin/pnl", label: "P&L" },
    { href: "/admin/business-plan", label: "Business Plan" },
    { href: "/admin/expenses", label: "Expenses" },
    { href: "/admin/discounts", label: "Discount Rules" },
    { href: "/admin/coupons", label: "Coupon Codes" },
  ] },
  { label: "Less Common", accent: "bronze", links: [
    { href: "/admin/inventory", label: "Inventory" },
    { href: "/admin/edit-chapter", label: "Edit Chapters" },
    { href: "/admin/add-chapter", label: "Add Chapter" },
    { href: "/admin/marketing-assets", label: "Marketing Assets" },
    { href: "/admin/brand-profile", label: "Brand Profile" },
    { href: "/admin/settings", label: "API Keys & Settings" },
  ] },
];

/** Primary destinations for the phone bottom tab bar. */
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
