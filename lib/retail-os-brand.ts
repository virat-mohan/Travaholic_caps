// Retail OS brand configuration — Travaholic instance.
//
// The CONTRACT (types, defineRetailOsBrand, validateRetailOsBrand, titleBrandName)
// now comes from the shared versioned package @retail-os/brand-config
// (github:virat-mohan/retail-os-brand-config, pinned in package.json). This file
// holds only Travaholic's VALUES — no local copy of the contract, so there is one
// canonical source and no drift. Values are unchanged from the previous local
// implementation. Governed by case-study/BRAND_OUTPUT_STANDARD.md v1.1 in
// virat-mohan/ViratMohan.
import {
  defineRetailOsBrand,
  type RetailOsBrand,
  type BrandProfile,
} from "@retail-os/brand-config/brand-identity";

// Re-export the contract surface so existing "@/lib/retail-os-brand" imports keep working.
export type { RetailOsBrand, BrandProfile };
export { validateRetailOsBrand, titleBrandName } from "@retail-os/brand-config/brand-identity";

// The brand voice/commerce profile the AI/marketing pipeline reads (via lib/brand.ts).
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

export const travaholicBrand: RetailOsBrand = defineRetailOsBrand({
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
    ogImagePath: "/images/brand/og-image.jpg",
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
});

/** The active brand for this deployment. */
export const brand: RetailOsBrand = travaholicBrand;
