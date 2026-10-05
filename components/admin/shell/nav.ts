// Canonical Retail OS 11-section dashboard navigation.
// All existing routes preserved; regrouped under the standard sections.
// Hidden sections (no modules) are omitted from the array.

export type NavLink = { href: string; label: string };
export type Accent = "terracotta" | "cobalt" | "magenta" | "gold" | "bronze";
export type NavSection = { label: string; accent: Accent; links: NavLink[]; canonicalSection: string };

export const NAV_SECTIONS: NavSection[] = [
  // 1. Command Centre — always visible, landing page
  { label: "Command Centre", accent: "gold", canonicalSection: "command_centre", links: [] },

  // 2. Brand — brand profile and identity
  { label: "Brand", accent: "bronze", canonicalSection: "brand", links: [
    { href: "/admin/brand-profile", label: "Brand Profile" },
  ] },

  // 3. Catalogue — products, chapters, content
  { label: "Catalogue", accent: "terracotta", canonicalSection: "catalogue", links: [
    { href: "/admin/edit-chapter", label: "Edit Chapters" },
    { href: "/admin/add-chapter", label: "Add Chapter" },
    { href: "/admin/marketing-assets", label: "Marketing Assets" },
  ] },

  // 4. Commerce — orders, checkout, pay-with-a-post
  { label: "Commerce", accent: "terracotta", canonicalSection: "commerce", links: [
    { href: "/admin/orders", label: "Orders" },
    { href: "/admin/orders/new", label: "Add Manual Order" },
    { href: "/admin/post-barter", label: "Pay With A Post" },
    { href: "/admin/returns", label: "Return Requests" },
    { href: "/admin/discounts", label: "Discount Rules" },
    { href: "/admin/coupons", label: "Coupon Codes" },
  ] },

  // 5. Growth — marketing, analytics, CRM, campaigns
  { label: "Growth", accent: "cobalt", canonicalSection: "growth", links: [
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
  ] },

  // 6. Inventory Master — stock
  { label: "Inventory Master", accent: "bronze", canonicalSection: "inventory_master", links: [
    { href: "/admin/inventory", label: "Inventory" },
  ] },

  // 7. Finance — P&L, business plan, expenses
  { label: "Finance", accent: "gold", canonicalSection: "finance", links: [
    { href: "/admin/pnl", label: "P&L" },
    { href: "/admin/business-plan", label: "Business Plan" },
    { href: "/admin/expenses", label: "Expenses" },
  ] },

  // 8. Operations — logistics, shipments
  { label: "Operations", accent: "magenta", canonicalSection: "operations", links: [
    { href: "/admin/logistics", label: "Shipments & RTO" },
  ] },

  // 11. Settings — API keys, integrations
  { label: "Settings", accent: "bronze", canonicalSection: "settings", links: [
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
