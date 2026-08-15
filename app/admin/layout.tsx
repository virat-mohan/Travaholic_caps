import Link from "next/link";

const NAV_SECTIONS = [
  {
    label: "Store",
    links: [
      { href: "/admin/dashboard", label: "Dashboard" },
      { href: "/admin/edit-chapter", label: "Edit Chapters" },
      { href: "/admin/add-chapter", label: "Add Chapter" },
      { href: "/admin/discounts", label: "Discount Rules" },
    ],
  },
  {
    label: "Content",
    links: [
      { href: "/admin/journal-drafts", label: "Journal Draft Generator" },
      { href: "/admin/newsletter", label: "Newsletter" },
      { href: "/admin/invoice-preview", label: "Invoice Preview" },
    ],
  },
  {
    label: "Customers",
    links: [
      { href: "/admin/customers", label: "Customers & Miles" },
      { href: "/admin/leads", label: "Leads" },
    ],
  },
  {
    label: "Community",
    links: [{ href: "/admin/explorer-submissions", label: "Explorer Submissions" }],
  },
  {
    label: "Marketing",
    links: [
      { href: "/admin/ad-briefs", label: "Ad Brief Generator" },
      { href: "/admin/marketing-assets", label: "Marketing Assets" },
      { href: "/admin/brand-profile", label: "Brand Profile" },
      { href: "/admin/reports", label: "Growth Reports" },
      { href: "/admin/agent-log", label: "Ad Agent" },
    ],
  },
  {
    label: "Configuration",
    links: [{ href: "/admin/settings", label: "API Keys & Settings" }],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full">
      <aside className="sticky top-0 hidden h-screen w-[22rem] shrink-0 flex-col overflow-y-auto border-r border-divider bg-surface px-5 pt-8 pb-10 md:flex">
        <p className="mb-4 text-micro uppercase tracking-[0.15em] text-secondary-text">Admin</p>
        <nav className="columns-2 gap-6">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="mb-6 break-inside-avoid">
              <p className="mb-2 text-micro uppercase tracking-[0.1em] text-secondary-text/70">
                {section.label}
              </p>
              <ul className="space-y-1.5">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="block text-body-s text-ink hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
