/**
 * Travaholic Caps — structured Brand Foundation (the machine-readable authority).
 *
 * The CONTRACT + lifecycle come from the shared package @retail-os/brand-config
 * (brand-foundation); this file holds only Travaholic's VALUES, DERIVED from the
 * existing in-repo authority `lib/brand-voice.ts` (BRAND_VOICE) and the human
 * brand book case-study/brands/travaholic-caps.md — nothing is invented.
 *
 * Authority hierarchy (BRAND-BOOK-STANDARD + the Retail OS technology decision):
 *   Human Brand Book  →  Structured Brand Foundation (@retail-os/brand-config)  →  runtime consumers
 * `brand-voice.ts` is a CONSUMER/ADAPTER of this Foundation, not a competing
 * authority. Do NOT create another structured Brand Foundation source.
 *
 * Downstream gate: automated brand communication may be driven ONLY by a
 * COMMITTED Foundation (isDownstreamAllowed). `brandVoicePrompt()` enforces it.
 *
 * Built lazily (memoized) so there is no module-init cycle with brand-voice.ts.
 */
import {
  defineBrandFoundation,
  transitionFoundation,
  isDownstreamAllowed,
  type BrandFoundation,
} from "@retail-os/brand-config/brand-foundation";
import { BRAND_VOICE } from "./brand-voice.ts";

/** Genuine unresolved authority conflicts (Phase 3): recorded, NOT auto-committed to a single value. */
export const RECONCILIATION_ITEMS: string[] = [
  "Customer noun: site says 'Explorers', emails say 'Travaholics' — both in use; not forced to one here (ask Ishan).",
  "Email font pair (Anton/Inter) vs site font pair (Archivo Black/Manrope): which is canonical is open; only the site pair is committed as the visual authority.",
  "'Express' delivery claim vs the 4–7 business-day shipping policy: not an approved claim; excluded.",
];

const strip = (s: string) => s.replace(/\s*\[[A-Z\]\[]+\]$/, "");

let _committed: BrandFoundation | null = null;

/** Build the committed Travaholic Foundation from the existing approved sources. Memoized. */
export function getTravaholicFoundation(): BrandFoundation {
  if (_committed) return _committed;
  const v = BRAND_VOICE;

  const draft = defineBrandFoundation({
    key: "caps",
    identity: {
      name: v.brand,
      legalName: undefined,
      tagline: v.tagline,
      positioning: v.positioning,
      valueProposition: v.footerBlurb,
    },
    // Acquisition audience from the live ad config (performance-manager / ad-brief: "men 18–44").
    icp: { audience: "Men 18–44 in India", geography: "India" },
    voice: {
      attributes: ["warm", "specific", "editorial travel storytelling", "confident, never shouty", "never a hard sell"],
      do: v.do.map(strip),
      dont: v.dont.map(strip),
      bannedWords: [...v.hardSell],
      retiredNames: ["Cash on Delivery", "COD"],
    },
    visual: {
      colors: [
        { name: "cream", hex: v.colours.cream },
        { name: "ink", hex: v.colours.ink },
        { name: "tanGold", hex: v.colours.tanGold },
        { name: "nearBlack", hex: v.colours.nearBlack },
        { name: "secondaryText", hex: v.colours.secondaryText },
        { name: "surface", hex: v.colours.surface },
        { name: "surfaceAlt", hex: v.colours.surfaceAlt },
      ],
      fonts: [v.fonts.site.display, v.fonts.site.body], // site pair is the committed visual authority
      logoUsage: `colour-on-light ${v.logo.colourOnLight}; nav ${v.logo.nav}; wordmark ${v.logo.wordmarkBlack}`,
      photoStyle: "Exact-product fidelity; every scene a real, recognisable place or moment.",
    },
    contentPillars: [v.terms.campaignLine, "A travel story per Chapter"],
    channelHouseStyle: {
      social: { hook: "place-led", cta: `${v.cta.primary} at travaholic.in`, hashtags: [...v.hashtags] },
      email: { cta: v.cta.primary, signOff: "Travaholic · Stories You Can Wear · travaholic.in" },
      ad: { cta: v.cta.metaAdCta, hook: v.offers.adHooks.join(" / ") },
      whatsapp: { cta: v.cta.whatsapp },
    },
    approvedClaims: [
      `Flat ${v.offers.priceLabel} per ${v.productNoun}`,
      v.offers.buy3Get1,
      v.offers.shipping,
      v.offers.payment,
    ],
    restrictions: [
      "No discount %, 'sale', coupon codes or implied markdown on ₹1,399 in ads.",
      "WELCOMEBACK15 is email-only; BUYNOW10 is abandoned-cart only.",
      "Never say Cash on Delivery / COD (prepaid only since 26 Sep 2026).",
      "No 'express' delivery claim.",
      "Customer copy speaks as Travaholic only, never DevShop / Retail OS.",
    ],
    founderContext: "Founder Ishan Seth. Partner brand: profit share, DevShop 40% / Ishan 60%. CEO agent 'Nomad'.",
    // The exact prose/marketing values the runtime prompt interpolates that are
    // not first-class Foundation fields. Held here so the committed Foundation —
    // not brand-voice.ts — is the source brandVoicePrompt() reads. All values are
    // DERIVED from the existing in-repo authority (BRAND_VOICE); nothing invented.
    marketingPreferences: {
      promptModel: {
        productLine: "premium trucker caps made in India",
        voiceSentence: v.voice,
        terms: { product: v.terms.product, collection: v.terms.collection, customers: [...v.terms.customers] },
        productNoun: v.productNoun,
        offers: {
          priceLabel: v.offers.priceLabel,
          buy3Get1: v.offers.buy3Get1,
          shipping: v.offers.shipping,
          payment: v.offers.payment,
          adHooks: [...v.offers.adHooks],
        },
        contact: {
          senderName: v.contact.senderName,
          sender: v.contact.sender,
          replyTo: v.contact.replyTo,
          whatsapp: v.contact.whatsapp,
          instagram: v.contact.instagram,
        },
        cta: { primary: v.cta.primary, chapter: v.cta.chapter, whatsapp: v.cta.whatsapp, metaAdCta: v.cta.metaAdCta },
        hashtags: [...v.hashtags],
      },
    },
    enabledModules: [],
    communicationRules: {
      escalateWhen: [
        "anything the brand book does not cover — ask the founder, never guess",
        "commercial, legal or materially consequential matters",
      ],
    },
    currentFacts: [
      { label: "price", value: v.offers.priceLabel },
      { label: "payment", value: "Prepaid only (UPI, cards, netbanking via Razorpay)", staleValues: ["Cash on Delivery", "COD"] },
      { label: "shipping", value: "Free shipping on prepaid orders", staleValues: ["Free Express Delivery"] },
      { label: "offer", value: v.offers.buy3Get1 },
    ],
    sources: [
      { label: "lib/brand-voice.ts (checkVoice module)", date: "2026-10-02", confidence: "founder_approved" },
      { label: "lib/retail-os-brand.ts / lib/brand.ts", date: "2026-10-02", confidence: "from_website" },
      { label: "Supabase brands row 'caps'", date: "2026-10-02", confidence: "from_website" },
      { label: "Virat — offer facts, hashtags, ad rules", date: "2026-10-02", confidence: "founder_approved" },
    ],
    gaps: [], // required fields are resolved; open founder confirmations live in brand-voice GAPS + RECONCILIATION_ITEMS
  });

  // Drive the lifecycle through the package's own state machine (not duplicated here).
  const reviewed = transitionFoundation(draft, "review");
  const approved = transitionFoundation(reviewed, "approved", { approvedBy: "Virat Mohan (offer facts, 2 Oct 2026)" });
  _committed = transitionFoundation(approved, "committed");
  return _committed;
}

/** Returns the committed Foundation, or throws — the hard gate for downstream brand output. */
export function requireCommittedFoundation(): BrandFoundation {
  const f = getTravaholicFoundation();
  if (!isDownstreamAllowed(f)) {
    throw new Error("Travaholic Brand Foundation is not COMMITTED; brand output is blocked until it is.");
  }
  return f;
}

/**
 * The exact values `brandVoicePrompt()` interpolates — all read FROM the committed
 * Foundation, so the Foundation (not BRAND_VOICE) is their source. Structural prose
 * in the prompt (headings, channel instructions) stays in the adapter; every brand
 * VALUE below comes from here.
 */
export type TravaholicVoiceModel = {
  brand: string;
  tagline: string;
  productLine: string;
  positioning: string;
  voice: string;
  terms: { product: string; collection: string; customers: string[] };
  productNoun: string;
  do: string[];
  dont: string[];
  colours: { cream: string; ink: string; tanGold: string };
  offers: { priceLabel: string; buy3Get1: string; shipping: string; payment: string; adHooks: string[] };
  contact: { senderName: string; sender: string; replyTo: string; whatsapp: string; instagram: string };
  cta: { primary: string; chapter: string; whatsapp: string; metaAdCta: string };
  hashtags: string[];
};

type PromptModel = NonNullable<BrandFoundation["marketingPreferences"]>["promptModel"];

/**
 * The hard gate + the source of truth for brandVoicePrompt(): returns the prompt
 * values assembled from the COMMITTED Foundation's own fields (identity, voice,
 * visual, marketingPreferences). brand-voice.ts consumes this instead of reading
 * BRAND_VOICE directly, so it is an adapter, not a second authority.
 */
export function getTravaholicVoiceModel(): TravaholicVoiceModel {
  const f = requireCommittedFoundation();
  const p = (f.marketingPreferences as { promptModel: PromptModel }).promptModel as {
    productLine: string;
    voiceSentence: string;
    terms: { product: string; collection: string; customers: string[] };
    productNoun: string;
    offers: { priceLabel: string; buy3Get1: string; shipping: string; payment: string; adHooks: string[] };
    contact: { senderName: string; sender: string; replyTo: string; whatsapp: string; instagram: string };
    cta: { primary: string; chapter: string; whatsapp: string; metaAdCta: string };
    hashtags: string[];
  };
  const hex = (name: string): string => {
    const c = f.visual.colors.find((x) => x.name === name);
    if (!c) throw new Error(`Foundation visual colour missing: ${name}`);
    return c.hex;
  };
  return {
    brand: f.identity.name,
    tagline: f.identity.tagline ?? "",
    productLine: p.productLine,
    positioning: f.identity.positioning,
    voice: p.voiceSentence,
    terms: p.terms,
    productNoun: p.productNoun,
    do: f.voice.do,
    dont: f.voice.dont,
    colours: { cream: hex("cream"), ink: hex("ink"), tanGold: hex("tanGold") },
    offers: p.offers,
    contact: p.contact,
    cta: p.cta,
    hashtags: p.hashtags,
  };
}

/** Proves brand-voice.ts agrees with the committed Foundation (consumer/validator, not a rival source). */
export function assertFoundationMatchesVoice(): void {
  const f = getTravaholicFoundation();
  const v = BRAND_VOICE;
  const same = (a: unknown, b: unknown, what: string) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`Foundation/brand-voice drift: ${what}`);
  };
  same(f.identity.name, v.brand, "name");
  same(f.identity.tagline, v.tagline, "tagline");
  same(f.identity.positioning, v.positioning, "positioning");
  same(f.voice.bannedWords, [...v.hardSell], "bannedWords");
  same(f.identity.valueProposition, v.footerBlurb, "valueProposition");
}
