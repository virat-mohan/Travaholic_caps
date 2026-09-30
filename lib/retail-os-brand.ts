// Retail OS brand configuration — Travaholic instance.
//
// Canonical contract & source of truth: the `virat-mohan/ViratMohan` repo,
// `retail-os/brand-config/` (the Retail OS brand-configuration layer), governed
// by `case-study/BRAND_OUTPUT_STANDARD.md` v1.1 — viratmohan.com design
// authority → DevShop expression → Retail OS expression → client brand config.
//
// This file is Travaholic's INSTANCE of that contract: the single in-repo place
// its brand identity lives. Travaholic stays visually and verbally Travaholic —
// this makes it "a Retail OS product configured as Travaholic", not "Travaholic
// made to look like Retail OS".
//
// Deterministic and isomorphic: plain constants, no server-only imports, no
// network call and no AI needed to know name/logo/domain/terminology. Safe to
// import from server components, client components and tests alike.
//
// Until the canonical layer is published as a shared package that this repo can
// depend on, a brand consumes it by conforming to the contract locally (one
// small module, not a copy of the whole standard). Extending the same pattern
// to Moon-glasses and Ceremony is described in the Stage 9B report.

/** The brand voice/commerce profile the marketing/AI pipeline already reads. */
export type BrandProfile = {
  brandName: string;
  tagline: string;
  voice: string;
  productNoun: string;
  currencySymbol: string;
  siteUrl: string;
  instagramHandle: string;
};

// Moved here from lib/brand.ts so there is ONE in-repo source for these values,
// shared by the AI pipeline (via lib/brand.ts) and the customer-facing surfaces.
// Values are unchanged.
export const DEFAULT_BRAND_PROFILE: BrandProfile = {
  brandName: "Travaholic",
  tagline: "Stories You Can Wear",
  voice:
    "Warm, specific, editorial travel storytelling — never a hard sell. Every product ties back to a real place or moment. Confident but never shouty.",
  productNoun: "trucker cap",
  currencySymbol: "₹",
  siteUrl: "https://travaholic.in",
  instagramHandle: "@travaholiccaps",
};

export type PostalAddress = {
  streetAddress: string;
  addressLocality: string;
  addressRegion: string;
  postalCode: string;
  addressCountry: string;
  /** Single-line form as shown in the footer. */
  full: string;
};

export type RetailOsBrand = {
  key: string;
  profile: BrandProfile;
  description: string;
  keywords: string[];
  assets: {
    orgLogoPath: string; // absolute-from-root path used in Organization JSON-LD
    navLogoPath: string;
    navLogoAlt: string;
    footerWordmarkPath: string;
    ogImagePath: string;
  };
  footerBlurb: string;
  gstin: string;
  contact: {
    email: string;
    whatsappLabel: string;
    whatsappHref: string;
  };
  social: { instagram: string; facebook: string };
  address: PostalAddress;
};

/** Travaholic — exact current identity values (no visible change on consumption). */
export const travaholicBrand: RetailOsBrand = {
  key: "caps",
  profile: DEFAULT_BRAND_PROFILE,
  description:
    "Travaholic makes premium trucker caps in India, each one inspired by a real place or journey. Flat ₹1,399 pricing, ships across India. Shop the full Collection at travaholic.in.",
  keywords: ["trucker caps India", "premium caps", "travel inspired caps", "Travaholic"],
  assets: {
    orgLogoPath: "/images/brand/travaholic-logo-color-black-text.png",
    navLogoPath: "/images/brand/travaholic-logo-color-v2.png",
    navLogoAlt: "Travaholic",
    footerWordmarkPath: "/images/brand/travaholic-wordmark-black.png",
    ogImagePath: "/images/brand/travaholic-logo-square-preview.png",
  },
  footerBlurb:
    "Stories you can wear. Premium trucker caps inspired by journeys, landscapes and moments worth remembering.",
  gstin: "GSTIN 07BZNPS5735B2Z3",
  contact: {
    email: "travaholiccaps@gmail.com",
    whatsappLabel: "+91 88003 39125 (WhatsApp)",
    whatsappHref: "https://wa.me/918800339125",
  },
  social: {
    instagram: "https://instagram.com/travaholiccaps",
    facebook: "https://facebook.com/profile.php?id=100080234022161",
  },
  address: {
    streetAddress: "C-152, Industrial Phase-1, Okhla",
    addressLocality: "South Delhi",
    addressRegion: "Delhi",
    postalCode: "110020",
    addressCountry: "IN",
    full: "C-152, Industrial Phase-1, Okhla, South Delhi, Delhi, 110020",
  },
};

/** The active brand for this deployment. One line to repoint a fork at another brand. */
export const brand: RetailOsBrand = travaholicBrand;

/** Deterministic validation — required identity fields present and well-formed. */
export function validateRetailOsBrand(b: RetailOsBrand): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!b.key?.trim()) errors.push("key is required");
  if (!b.profile?.brandName?.trim()) errors.push("profile.brandName is required");
  if (!b.profile?.siteUrl?.startsWith("http")) errors.push("profile.siteUrl must be an absolute URL");
  if (!b.description?.trim()) errors.push("description is required");
  if (!b.assets?.navLogoPath?.startsWith("/")) errors.push("assets.navLogoPath must be a root-relative path");
  if (!b.assets?.ogImagePath?.startsWith("/")) errors.push("assets.ogImagePath must be a root-relative path");
  return { ok: errors.length === 0, errors };
}
