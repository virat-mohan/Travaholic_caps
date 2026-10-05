/**
 * Travaholic Caps brand voice: the "brand book lock" module
 * (viratmohan.com case-study/BRAND-BOOK-STANDARD.md; brand book case-study/brands/travaholic-caps.md). Every send path, approval screen and AI
 * generation in this repo reads the brand from here. Reference
 * implementation: Ceremony OS lib/brand-voice.ts.
 *
 * NO WRITTEN BRAND BOOK EXISTS FOR TRAVAHOLIC CAPS. On 2 Oct 2026, a search of
 * ~/Desktop and ~/Downloads found no Caps brand book. The only Travaholic
 * design file, ~/Desktop/Travaholic/design_guidelines.json, belongs to
 * Travaholic Stays (the villa business), so it is not used here. This module
 * is built ONLY from Caps' own live sources, cited on each fact:
 *   [RB]   lib/retail-os-brand.ts (DEFAULT_BRAND_PROFILE, travaholicBrand)
 *   [CSS]  app/globals.css (:root design tokens)
 *   [FONT] app/layout.tsx (next/font: Archivo_Black, Manrope)
 *   [WB]   lib/email-templates/welcomeback15.ts ("Postcards from India" email)
 *   [EC]   lib/email-campaigns.ts (sender, reply-to, WELCOMEBACK15)
 *   [EM]   lib/email.ts (abandoned-cart and BUYNOW10 emails)
 *   [AC]   lib/abandoned-cart.ts (BUYNOW10_COUPON_CODE)
 *   [PM]   lib/performance-manager.ts (getPmConfig copyRules, DEFAULT_MESSAGES)
 *   [OP]   lib/order-pricing.ts (COD refused store-wide)
 *   [CART] app/cart/CartClient.tsx (Buy 3, Get 1 Free copy)
 *   [SP]   app/shipping-policy/page.tsx
 *   [NAV]  components/navigation/Navbar.tsx, app/page.tsx (Chapters, Story Series, Explorers)
 *   [JRN]  lib/claude.ts (journal voice: specific, sensory, magazine credit)
 *   [IMG]  lib/image-gen.ts (exact-product fidelity rule)
 *   [V]    Virat, 2 Oct 2026: offer facts, hashtags, COD removed 26 Sep 2026,
 *          WELCOMEBACK15 email-only, BUYNOW10 abandoned-cart only, ad rules.
 * Anything these sources do not cover is in GAPS (for
 * Ishan Seth) and is never guessed.
 *
 * Pure module (no imports), so it runs under `node --test` and in the app.
 * lib/brand-voice.test.ts checks these constants still match [RB].
 */

export type VoiceChannel = "email" | "whatsapp" | "social" | "ad" | "site" | "ai";
export type VoiceKind = VoiceChannel;
export type VoiceLevel = "block" | "warn";
export type VoiceFinding = { level: VoiceLevel; rule: string; match: string; fix: string };
/** Which flow the copy belongs to. Unlocks a code only where it is allowed. */
export type VoiceCampaign = "abandoned_cart" | "welcomeback15";
export type VoiceOptions = { channel: VoiceChannel; campaign?: VoiceCampaign };
export type VoiceResult = { ok: boolean; blocks: string[]; warnings: string[] };

export const BRAND_VOICE = {
  source:
    "No written Caps brand book exists (searched 2 Oct 2026). Built from lib/retail-os-brand.ts, app/globals.css, app/layout.tsx, lib/email-templates/welcomeback15.ts, lib/email-campaigns.ts, lib/performance-manager.ts copy rules, and Virat's offer facts of 2 Oct 2026.",
  brand: "Travaholic", // [RB] profile.brandName
  tagline: "Stories You Can Wear", // [RB] profile.tagline
  productNoun: "trucker cap", // [RB] profile.productNoun
  /** [RB] travaholicBrand.description */
  positioning:
    "Travaholic makes premium trucker caps in India, each one inspired by a real place or journey. Flat ₹1,399 pricing, ships across India.",
  /** [RB] travaholicBrand.footerBlurb */
  footerBlurb:
    "Stories you can wear. Premium trucker caps inspired by journeys, landscapes and moments worth remembering.",
  /** [RB] profile.voice, verbatim */
  voice:
    "Warm, specific, editorial travel storytelling — never a hard sell. Every product ties back to a real place or moment. Confident but never shouty.",
  /** [NAV] site navigation and home page; [WB] "For our Travaholics" */
  terms: {
    product: "Chapter", // each cap design is a Chapter (/chapter/[slug])
    collection: "Story Series", // /series
    customers: ["Explorers", "Travaholics"],
    campaignLine: "Postcards from India", // [WB] section title
  },
  do: [
    "Tell a travel story: every cap ties back to a real place or moment. [RB]",
    "Be warm, specific and editorial: name the place, the light, the moment. Never generic travel-blog filler. [RB][JRN]",
    "Mention a Chapter the way a magazine credits an outfit, not a product placement. [JRN]",
    "Be confident but never shouty. [RB]",
    "When an offer is mentioned, lead with free shipping on prepaid orders; Buy 3, Get 1 Free is applied automatically at checkout. [PM][CART]",
  ],
  dont: [
    "Hard sell. [RB]",
    "Shout: stacked exclamation marks, pressure words. [RB]",
    "Mention Cash on Delivery / COD: removed store-wide on 26 Sep 2026, prepaid only. [V][OP]",
    "Put discount percentages, 'sale' or coupon codes in ads, or imply a markdown on ₹1,399. [PM][V]",
    "Use WELCOMEBACK15 outside email, or BUYNOW10 outside the abandoned-cart nudge. [V]",
  ],
  /** [CSS] :root. Accent and watercolour palettes are for photography/illustration only, never UI chrome. */
  colours: {
    cream: "#f0eee4", // Pantone 11-4201 Cloud Dancer, page background
    ink: "#101820", // text and dark panels
    tanGold: "#e6c68f", // accent: offer labels, CTA on ink
    nearBlack: "#171717",
    secondaryText: "#4a4a42",
    surface: "#ffffff",
    surfaceAlt: "#f0ebe0",
    accentFromPhotography: {
      forest: "#3f4a3d",
      ocean: "#40607a",
      clay: "#b36a4e",
      stone: "#8c8577",
      sand: "#d8cbb5",
      olive: "#6b6a4f",
      mist: "#c7cdc9",
    },
    watercolourEditorialOnly: {
      paintRed: "#d62828",
      paintAmber: "#f3a712",
      paintTeal: "#2a9d8f",
      paintIndigo: "#1d3557",
      paintViolet: "#8e44ad",
      paintOrange: "#e8590c",
      paintPlum: "#6a4c93",
      parchment: "#ddc9a3",
    },
    rule: "Narrow, warm-neutral, no bright brand colour. [CSS]",
  },
  /**
   * Verified 2 Oct 2026. The site and the emails use different pairs
   * (see GAPS). The admin's Anton/Inter is the DevShop
   * look, not the brand.
   */
  fonts: {
    site: { display: "Archivo Black", body: "Manrope" }, // [FONT] + [CSS] --font-display / --font-sans
    email: { display: "Anton", body: "Inter" }, // [WB] Google Fonts link, uppercase display
  },
  /** [RB] travaholicBrand.assets */
  logo: {
    colourOnLight: "/images/brand/travaholic-logo-color-black-text.png",
    nav: "/images/brand/travaholic-logo-color-v2.png",
    wordmarkBlack: "/images/brand/travaholic-wordmark-black.png",
    email: "/images/brand/travaholic-logo-email-v2.png", // [EM]
    ogImage: "/images/brand/og-image.jpg",
  },
  contact: {
    siteUrl: "https://travaholic.in", // [RB] (live links use https://www.travaholic.in [WB])
    instagram: "@travaholiccaps", // [RB]
    whatsapp: "+91 88003 39125", // [RB] customer WhatsApp
    whatsappHref: "https://wa.me/918800339125", // [RB]
    whatsappDigits: "918800339125",
    email: "travaholiccaps@gmail.com", // [RB]
    sender: "orders@travaholic.in", // [EC][EM] Brevo sender, name "Travaholic"
    senderName: "Travaholic", // [EC]
    replyTo: "travaholiccaps@gmail.com", // [EC]
  },
  /** [V] Instagram hashtags. The first two are the brand pair every feed caption carries. */
  hashtags: ["#travaholic", "#storiesyoucanwear", "#truckercap", "#postcardsfromindia", "#travelindia"],
  requiredSocialHashtags: ["#travaholic", "#storiesyoucanwear"],
  cta: {
    primary: "Shop the collection", // [WB] hero button
    chapter: "Pick your chapter", // [WB] final button
    cart: "Finish checking out", // [EM] abandoned-cart button
    whatsapp: "Questions? WhatsApp us on +91 88003 39125.", // [WB] footer + [RB] number
    metaAdCta: "SHOP_NOW", // lib/ad-brief.ts CTA enum
  },
  offers: {
    pricePerCap: 1399, // [V][RB] "Flat ₹1,399 pricing"
    priceLabel: "₹1,399",
    buy3Get1: "Buy 3, Get 1 Free, applied automatically at checkout", // [V][CART][PM]
    shipping: "Free shipping on prepaid orders", // [V][PM][WB]
    payment: "Prepaid only (UPI, cards, netbanking via Razorpay). Cash on Delivery was removed on 26 Sep 2026.", // [V][OP]
    codRemovedOn: "2026-09-26", // [V]
    /** The only hooks allowed in ads. [V][PM] */
    adHooks: ["Buy 3, Get 1 Free", "Free shipping on prepaid orders"],
  },
  /** Where each live code may appear. [V][EC][AC] */
  coupons: {
    WELCOMEBACK15: { channels: ["email"] as VoiceChannel[], note: "15% off, time-limited, email-only win-back code. Banned in ads." },
    GIFT10: { channels: ["email", "social", "site", "whatsapp"] as VoiceChannel[], note: "10% off, Diwali gifting offer, valid until 8 Nov 2026 (end of day IST). One discount per order, never stacked. Not for ads." },
    BUYNOW10: {
      channels: ["whatsapp", "email"] as VoiceChannel[],
      campaign: "abandoned_cart" as VoiceCampaign,
      note: "10% off, only for the stage-2 abandoned-cart nudge (WhatsApp first, email fallback).",
    },
  },
  /** Phrases that were true once and are not now. [V][OP] */
  stale: [
    { phrase: "Cash on Delivery / COD / pay on delivery", why: "COD was removed on 26 Sep 2026; Travaholic is prepaid only." },
  ],
  /** [RB] voice "never a hard sell", "never shouty". Warnings only. */
  hardSell: ["hurry", "act now", "last chance", "don't miss out", "dont miss out", "grab yours now", "buy now", "limited stock", "while stocks last"],
} as const;

/**
 * Questions only the founder (Ishan Seth, ishanseth23@gmail.com) can answer.
 * Until he does, the module does not guess: the matching checks only warn.
 */
export const GAPS: string[] = [
  "Is there a written Travaholic Caps brand book or style guide? None was found on disk; the only Travaholic design file is for Travaholic Stays. If not, can this module be approved as the Caps brand book?",
  "Fonts: the website uses Archivo Black (display) + Manrope (body), but the 'Postcards from India' emails use Anton + Inter. Which pair is canonical for emails, ads and social creatives?",
  "Delivery claim: the cart page and the WhatsApp cart reply say 'Free Express Delivery', but the shipping policy says dispatch in 1–2 business days and delivery in 4–7 business days. Is 'express' accurate, or should it read 'Free shipping on prepaid orders'?",
  "LOYAL10 is passed to the legacy win-back WhatsApp template (lib/legacy-winback.ts). Is it a live code, what is it worth, and in which channels may it appear?",
  "The referral email offers the friend a rupee discount on the first order. Is that an approved public offer that may also appear on social and the site, or email-only?",
  "Customer name: the site says 'Explorers' and the emails say 'Travaholics'. Which one should copy use, or both?",
  "Urgency lines: the ad-brief generator suggests on-image text like 'SELLING FAST' or 'NEW DROP'. Do these fit 'never a hard sell', and which, if any, are approved?",
  "Emoji: the WhatsApp cart reply uses 🧢📦💰. Are emoji on-brand for WhatsApp and Instagram captions, and is there a limit?",
  "Hashtags: is #travaholic #storiesyoucanwear #truckercap #postcardsfromindia #travelindia the complete approved set? The ad-brief generator currently asks for 8–15 hashtags including broad ones. Should captions use only these five, and how many per post?",
  "Sign-off: is there an approved sign-off for emails and WhatsApp (the emails end 'Travaholic · Stories You Can Wear · travaholic.in')?",
  "Logo usage: which logo variant goes on dark versus light backgrounds and on ad creatives, and are there clear-space or minimum-size rules?",
  "Photo style: beyond 'a real place or moment', are there rules for creatives (real customer photos versus AI scenes, people versus product-only, which Indian places to feature)?",
];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordRe = (w: string) => new RegExp(`(^|[^\\p{L}\\p{N}])(${esc(w)})(?=$|[^\\p{L}\\p{N}])`, "iu");

/** Plain, customer-visible text of an email's HTML (drops head/style/comments and tags). */
export function stripHtml(html: string): string {
  return (html ?? "")
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h\d|li|tr|td)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&bull;/g, "•")
    .replace(/[ \t]+/g, " ");
}

const NEGATION_BEFORE = /\b(no|not|without|never|isn'?t|is not|no longer|removed|discontinued|instead of)\b[^.\n]{0,20}$/i;
const NEGATION_AFTER = /^[^.\n]{0,30}\b(not available|no longer|isn'?t available|unavailable|removed|discontinued|not offered)\b/i;

function isNegated(text: string, index: number, length: number) {
  return NEGATION_BEFORE.test(text.slice(Math.max(0, index - 40), index)) || NEGATION_AFTER.test(text.slice(index + length, index + length + 40));
}

const CUSTOMER_WHATSAPP_LOCAL = "8800339125";

/**
 * Checks copy against the brand book. A block stops the send or approval;
 * a warning is logged and shown but does not stop anything.
 */
function runChecks(text: string, opts: VoiceOptions): VoiceResult {
  const t = text ?? "";
  const { channel, campaign } = opts;
  const blocks: string[] = [];
  const warnings: string[] = [];
  const block = (m: string) => blocks.push(m);
  const warn = (m: string) => warnings.push(m);
  // AI output is checked before anyone sees it; it is never sent as-is, so it only warns.
  const blockOrWarn = (m: string) => (channel === "ai" ? warn(m) : block(m));

  // 1. Stale: Cash on Delivery (removed 26 Sep 2026). [V][OP]
  const codRes = [/cash[\s-]*on[\s-]*delivery/gi, /\bC\.?O\.?D\b\.?/gi, /\bpay(?:ment)?\s+(?:on|at|upon)\s+delivery\b/gi];
  for (const re of codRes) {
    for (const m of t.matchAll(re)) {
      const negated = isNegated(t, m.index ?? 0, m[0].length);
      const msg = `"${m[0]}": Cash on Delivery was removed on 26 Sep 2026; Travaholic is prepaid only. Say "Free shipping on prepaid orders" instead. (stale-cod)`;
      if (channel === "ad") block(msg);
      else if (negated) warn(`"${m[0]}": mentions COD (as unavailable). Prefer leading with "Free shipping on prepaid orders". (stale-cod)`);
      else blockOrWarn(msg);
      break;
    }
  }

  // 2. Discount percentages. Email only for the live email offers; never in ads. [V][PM]
  const pctOff =
    t.match(/\b\d{1,3}\s?%\s*(?:off|discount|cash\s?back|savings?)\b/i) ??
    t.match(/\b(?:flat|save|extra|upto|up to|get)\s+\d{1,3}\s?%/i) ??
    t.match(/\b\d{1,3}\s?percent\s+off\b/i) ??
    t.match(/\byour\s+\d{1,3}\s?%/i);
  // Diwali gifting: "10% off" is allowed outside ads when it is the GIFT10 offer (approved by Virat 5 Oct 2026).
  const giftOffer = /\bGIFT10\b/.test(t) && /\b10\s?%\s*off\b/i.test(pctOff?.[0] ?? "") && channel !== "ad";
  if (pctOff && !giftOffer) {
    const msg = `"${pctOff[0]}": discount percentages are not a public offer. The only hooks are Buy 3, Get 1 Free and free shipping on prepaid orders. (discount-percent)`;
    if (channel === "ad" || channel === "social" || channel === "site") block(msg);
    else if (channel === "whatsapp" && campaign !== "abandoned_cart") block(msg);
    else if (channel === "ai") warn(msg);
  } else if (channel === "ad") {
    const bare = t.match(/\b\d{1,3}\s?%/);
    if (bare) warn(`"${bare[0]}": a percentage in an ad. Check it is not a discount. (discount-percent)`);
  }

  // 3. Coupon codes: each live code only where it is allowed. [V][EC][AC]
  const seenCodes = new Set<string>();
  for (const m of t.matchAll(/\b[A-Z]{3,}\d{1,3}\b/g)) {
    const code = m[0];
    if (seenCodes.has(code)) continue;
    seenCodes.add(code);
    const rule = (BRAND_VOICE.coupons as Record<string, { channels: VoiceChannel[]; campaign?: VoiceCampaign; note: string }>)[code];
    if (channel === "ad") {
      block(`"${code}": no coupon codes in ads. ${rule ? rule.note : ""} (coupon-in-ad)`.replace("  ", " "));
    } else if (rule) {
      const channelOk = rule.channels.includes(channel);
      const campaignOk = !rule.campaign || rule.campaign === campaign;
      if (!(channelOk && campaignOk)) blockOrWarn(`"${code}": ${rule.note} (coupon-scope)`);
    } else {
      warn(`"${code}": not a code in the brand facts (WELCOMEBACK15, BUYNOW10). Confirm with Ishan before using it. (unknown-coupon)`);
    }
  }

  // 4. Ads: no "sale", no other offer words, no markdowns on ₹1,399. [PM]
  if (channel === "ad" || channel === "social") {
    const sale = t.match(wordRe("sale"));
    if (sale) (channel === "ad" ? block : warn)(`"${sale[2]}": never say "sale"; prices are fixed at ₹1,399. (sale)`);
    for (const m of t.matchAll(/₹\s?([\d,]+)/g)) {
      const amount = Number(m[1].replace(/,/g, ""));
      if (amount && amount !== BRAND_VOICE.offers.pricePerCap) {
        (channel === "ad" ? block : warn)(`"${m[0]}": the price is ₹1,399; never imply a markdown. (markdown)`);
        break;
      }
    }
    if (/\bMRP\b|\bwas\s+₹/i.test(t)) (channel === "ad" ? block : warn)(`"MRP / was ₹": never imply a markdown on ₹1,399. (markdown)`);
  }
  if (channel === "ad") {
    for (const w of ["discount", "cashback", "cash back", "coupon", "promo code", "use code"]) {
      const m = t.match(wordRe(w));
      if (m) block(`"${m[2]}": ads carry only Buy 3, Get 1 Free and free prepaid shipping as hooks. (ad-offer)`);
    }
    const ship = t.match(/free\s+(?:shipping|delivery)/i);
    if (ship && !/prepaid|pay(?:ing)?\s+online|paid online/i.test(t))
      warn(`"${ship[0]}": say "free shipping on prepaid orders". (ad-shipping)`);
  }

  // 5. Unverified delivery-speed claim (open question for Ishan). [SP]
  const express = t.match(/\bexpress\s+(?:delivery|shipping)\b/i);
  if (express) warn(`"${express[0]}": unverified. The shipping policy says delivery in 4–7 business days. (express-claim)`);

  // 6. Name, domain, handle, numbers. [RB]
  const misspelt = t.match(/\btrav(?:el|o|e|ah)holics?\b/i);
  if (misspelt) blockOrWarn(`"${misspelt[0]}": the brand is spelt "Travaholic". (brand-spelling)`);
  if (/\bTravaHolic\b/.test(t)) warn(`"TravaHolic": write "Travaholic". (brand-spelling)`);
  const domain = t.match(/\btravaholic\.com\b/i);
  if (domain) blockOrWarn(`"${domain[0]}": the site is travaholic.in. (wrong-domain)`);
  const handle = t.match(/@travaholic(?!caps)\b/i);
  if (handle) warn(`"${handle[0]}": the Instagram handle is @travaholiccaps. (wrong-handle)`);
  const usSender = t.match(/\+?1[\s-]?\(?555\)?[\s-]?344[\s-]?0937|15553440937/);
  if (usSender) blockOrWarn(`"${usSender[0]}": that is the sending number, not for customers. Customers WhatsApp +91 88003 39125. (wrong-number)`);
  for (const m of t.matchAll(/(?:\+?91[\s-]?)?\b([6-9]\d{4})[\s-]?(\d{5})\b/g)) {
    if (`${m[1]}${m[2]}` !== CUSTOMER_WHATSAPP_LOCAL) {
      warn(`"${m[0]}": the customer WhatsApp number is +91 88003 39125. (other-number)`);
      break;
    }
  }
  const devshop = t.match(/\bdev\s?shop\b|\bretail\s?os\b|viratmohan\.com/i);
  if (devshop) warn(`"${devshop[0]}": customer copy speaks as Travaholic only, never DevShop. (devshop-mention)`);

  // 7. Tone: never a hard sell, never shouty. [RB]
  for (const w of BRAND_VOICE.hardSell) {
    const m = t.match(wordRe(w));
    if (m) warn(`"${m[2]}": never a hard sell; invite with a story instead. (hard-sell)`);
  }
  if (/!{2,}/.test(t)) warn(`"!!": confident but never shouty. (shouty)`);

  // 8. Social captions carry the brand hashtags. [V]
  if (channel === "social" && t.trim().length >= 80) {
    for (const h of BRAND_VOICE.requiredSocialHashtags) {
      if (!new RegExp(`${esc(h)}(?![\\p{L}\\p{N}])`, "iu").test(t)) warn(`"${h}": add the brand hashtag. (missing-hashtag)`);
    }
    const tagCount = (t.match(/#[\p{L}\p{N}_]+/gu) ?? []).length;
    if (tagCount > 30) block(`${tagCount} hashtags: Instagram rejects more than 30. (hashtag-count)`);
  }

  return { ok: blocks.length === 0, blocks, warnings };
}

/**
 * Checks copy against the brand book. A "block" stops the send or approval;
 * a "warn" is logged and shown but stops nothing.
 */
export function checkVoice(text: string, kind: VoiceKind, opts: { campaign?: VoiceCampaign } = {}): VoiceFinding[] {
  const r = runChecks(text, { channel: kind, campaign: opts.campaign });
  const toFinding = (level: VoiceLevel) => (m: string): VoiceFinding => {
    const rule = m.match(/\(([a-z-]+)\)\s*$/)?.[1] ?? "brand-voice";
    const match = m.match(/^"([^"]*)"/)?.[1] ?? "";
    return { level, rule, match, fix: m.replace(/\s*\([a-z-]+\)\s*$/, "") };
  };
  return [...r.blocks.map(toFinding("block")), ...r.warnings.map(toFinding("warn"))];
}

export const hasBlock = (f: VoiceFinding[]) => f.some((x) => x.level === "block");

/** One-line summary of the blocks, for an error message or log. */
export function describeBlocks(f: VoiceFinding[]): string {
  return f.filter((x) => x.level === "block").map((x) => `${x.fix} (${x.rule})`).join(" | ");
}

/**
 * Send-path gate: runs checkVoice, logs, and says whether the send may go
 * ahead. Internal team messages skip it. Transactional sends (order, shipping,
 * returns) are never blocked: their blocks are only logged.
 */
export function voiceGate(
  text: string,
  kind: VoiceKind,
  where: string,
  opts: { internal?: boolean; transactional?: boolean; campaign?: VoiceCampaign } = {},
): { ok: boolean; findings: VoiceFinding[]; reason?: string } {
  if (opts.internal) return { ok: true, findings: [] };
  let findings: VoiceFinding[] = [];
  try {
    findings = checkVoice(text, kind, { campaign: opts.campaign });
  } catch (err) {
    console.error(`[brand-voice] check failed for ${where}, allowing`, err);
    return { ok: true, findings: [] };
  }
  const warns = findings.filter((f) => f.level === "warn");
  if (warns.length) console.warn(`[brand-voice] ${where} (${kind}) warnings: ${warns.map((w) => `${w.rule}: "${w.match}"`).join("; ")}`);
  if (hasBlock(findings)) {
    const reason = `Brand voice block (${where}): ${describeBlocks(findings)}`;
    if (opts.transactional) {
      console.warn(`[brand-voice] transactional, sent anyway. ${reason}`);
      return { ok: true, findings };
    }
    console.error(reason);
    return { ok: false, findings, reason };
  }
  return { ok: true, findings };
}

/** The brand book as an instruction block for every AI text or image generation. */
export function brandVoicePrompt(kind?: VoiceChannel | "image"): string {
  const v = BRAND_VOICE;
  const c = v.colours;
  const visual = [
    `Visual rules for ${v.brand}: narrow, warm-neutral palette (cream ${c.cream}, ink ${c.ink}, tan-gold ${c.tanGold}); other colours only as they occur naturally in the photograph; no bright brand colour.`,
    `Every scene is a real, recognisable place or moment (the brand is "${v.tagline}": each cap is tied to a real place). Lifestyle photography, not studio banners.`,
    "The cap must be the exact real product: never invent or alter patches, badges, logos, embroidery or text on it.",
    "No on-image prices other than ₹1,399, no discount percentages, no coupon codes, no 'sale', no Cash on Delivery.",
  ].join("\n");
  if (kind === "image") return visual;

  const channelLine: Record<VoiceChannel, string> = {
    email: `You are writing an email. Sender "${v.contact.senderName}" <${v.contact.sender}>, replies to ${v.contact.replyTo}. Display type is uppercase and short. CTA: "${v.cta.primary}" or "${v.cta.chapter}". End with "${v.cta.whatsapp}"`,
    whatsapp: `You are writing a WhatsApp message: short, warm, one clear link. Customers reach us on ${v.contact.whatsapp}.`,
    social: `You are writing an Instagram/Facebook caption: a place-led hook, the Chapter credited like a magazine credits an outfit, then "${v.cta.primary} at travaholic.in", then ${v.hashtags.join(" ")}. Handle ${v.contact.instagram}.`,
    ad: `You are writing a Meta ad. The ONLY hooks allowed are "${v.offers.adHooks.join('" and "')}". No discount percentages, no "sale", no coupon codes, no Cash on Delivery, no price other than ${v.offers.priceLabel}. CTA button ${v.cta.metaAdCta}. Audience: men 18–44.`,
    site: "You are writing website copy (product, journal or page text).",
    ai: "",
  };

  return [
    `You write for ${v.brand} ("${v.tagline}"), premium trucker caps made in India. ${v.positioning}`,
    `Voice: ${v.voice}`,
    `Words: each cap design is a "${v.terms.product}", collections are the "${v.terms.collection}", customers are "${v.terms.customers.join('" / "')}". Product noun: ${v.productNoun}. Spell the brand "Travaholic".`,
    `Do:\n${v.do.map((d) => `- ${d.replace(/\s*\[[A-Z\]\[]+\]$/, "")}`).join("\n")}`,
    `Don't:\n${v.dont.map((d) => `- ${d.replace(/\s*\[[A-Z\]\[]+\]$/, "")}`).join("\n")}`,
    `Current facts: ${v.offers.priceLabel} per cap. ${v.offers.buy3Get1}. ${v.offers.shipping}. ${v.offers.payment} Site travaholic.in, WhatsApp ${v.contact.whatsapp}, Instagram ${v.contact.instagram}.`,
    `Codes: WELCOMEBACK15 is email-only and time-limited; BUYNOW10 is only for the abandoned-cart nudge. Never invent a code or an offer.`,
    `Never write: Cash on Delivery, COD, travaholic.com, DevShop or Retail OS. Do not claim "express" delivery (unconfirmed; the shipping policy says 4–7 business days).`,
    kind && kind !== "ai" ? channelLine[kind] : "",
    kind === "social" || kind === "ad" ? visual : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
