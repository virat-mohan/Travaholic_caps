// Travaholic — BrandConfig for the canonical Retail OS dashboard contract.
//
// This is Travaholic's INSTANCE of the @retail-os/brand-config contract.
// It declares identity, enabled modules, module states, brand-specific
// extensions and navigation overrides. The package supplies the canonical
// 11-section structure, ordering, visibility logic and module-state taxonomy.
//
// Travaholic business logic stays here; nothing Travaholic-specific goes
// into the shared package.

import { defineBrand, type BrandConfig } from "@retail-os/brand-config/brand-config";
import type { ModuleDef } from "@retail-os/brand-config/modules";
import { travaholicBrand } from "@/lib/retail-os-brand";

const travaholicExtensions: ModuleDef[] = [
  // Explorer Submissions (community/UGC specific to Travaholic)
  {
    key: "explorer-submissions",
    label: "Explorer Submissions",
    classification: "client-extension",
    defaultEnabled: true,
    navGroup: "marketing",
    ownerBrand: "caps",
  },
];

export const travaholicConfig: BrandConfig = defineBrand({
  identity: travaholicBrand,
  design: {
    expression: "paper",
    bg: "#f4ead4",
    ink: "#1a1410",
    gold: "#d4af37",
    secondary: "#d9714b",
    fonts: { display: "Anton", serif: "Instrument Serif", sans: "Inter" },
  },
  commerce: {
    currency: "INR",
    productNounPlural: "caps",
    productUnitNounSingular: "Chapter",
    productUnitNounPlural: "Chapters",
    priceDisplay: "inclusive",
    checkout: { codEnabled: false },
  },
  integrations: {
    payment: ["razorpay", "upi"],
    logistics: "shiprocket",
    whatsapp: "msg91",
    meta: true,
    google: false,
    email: null,
    analytics: "first_party",
  },
  experience: {
    terminology: {
      product: "Chapter",
      products: "Chapters",
    },
  },
  modules: {
    // Core modules are always on; these are the optional ones Travaholic enables
    loyalty: true,
    referrals: true,
    journal: true,
    "community-ugc": true,
    "pay-with-a-post": true,
    "ai-ad-briefs": true,
    "performance-manager": true,
    "growth-recommendations": true,
    "business-plan": true,
    "ai-media-gen": true,
    "whatsapp-inbox": true,
    "ux-insights": true,
    "abandoned-cart": true,
    "leads-crm": true,
  },
  extensions: travaholicExtensions,
});
