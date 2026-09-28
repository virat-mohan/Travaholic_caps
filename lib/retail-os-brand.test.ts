// Focused tests for the Retail OS brand config (Travaholic instance).
// Runs on Node's built-in test runner with type-stripping — no new dependency:
//   node --experimental-strip-types --test lib/retail-os-brand.test.ts
//
// The "expected" values below are the EXACT strings that were hardcoded in
// app/layout.tsx, Navbar and the footer before this change. If a value here
// ever drifts from what the surfaces render, output has changed — which this
// migration must not do.
import { test } from "node:test";
import assert from "node:assert/strict";
import { brand, travaholicBrand, DEFAULT_BRAND_PROFILE, validateRetailOsBrand } from "./retail-os-brand.ts";

test("active brand is Travaholic and config is valid", () => {
  assert.equal(brand, travaholicBrand);
  const { ok, errors } = validateRetailOsBrand(brand);
  assert.equal(ok, true, errors.join("; "));
});

test("identity fields preserve the previous hardcoded values", () => {
  assert.equal(brand.profile.brandName, "Travaholic");
  assert.equal(brand.profile.tagline, "Stories You Can Wear");
  assert.equal(brand.profile.siteUrl, "https://travaholic.in");
  assert.equal(brand.profile.currencySymbol, "₹");
  assert.equal(brand.profile.productNoun, "trucker cap");
  assert.equal(brand.profile.instagramHandle, "@travaholiccaps");
});

test("metadata surface values are unchanged", () => {
  assert.equal(
    brand.description,
    "Travaholic makes premium trucker caps in India, each one inspired by a real place or journey. Flat ₹1,399 pricing, ships across India. Shop the full Collection at travaholic.in.",
  );
  assert.deepEqual(brand.keywords, [
    "trucker caps India",
    "premium caps",
    "travel inspired caps",
    "Travaholic",
  ]);
  // Derived title strings the layout builds.
  assert.equal(`${brand.profile.brandName} — ${brand.profile.tagline}`, "Travaholic — Stories You Can Wear");
  assert.equal(`%s — ${brand.profile.brandName}`, "%s — Travaholic");
  assert.equal(brand.assets.ogImagePath, "/images/brand/og-image.jpg");
  assert.equal(`${brand.profile.siteUrl}${brand.assets.orgLogoPath}`, "https://travaholic.in/images/brand/travaholic-logo-color-black-text.png");
});

test("header logo surface is unchanged", () => {
  assert.equal(brand.assets.navLogoPath, "/images/brand/travaholic-logo-color-v2.png");
  assert.equal(brand.assets.navLogoAlt, "Travaholic");
});

test("footer surface values are unchanged", () => {
  assert.equal(brand.footerBlurb, "Stories you can wear. Premium trucker caps inspired by journeys, landscapes and moments worth remembering.");
  assert.equal(brand.address.full, "C-152, Industrial Phase-1, Okhla, South Delhi, Delhi, 110020");
  assert.equal(brand.gstin, "GSTIN 07BZNPS5735B2Z3");
  assert.equal(brand.contact.email, "travaholiccaps@gmail.com");
  assert.equal(brand.contact.whatsappLabel, "+91 88003 39125 (WhatsApp)");
  assert.equal(brand.contact.whatsappHref, "https://wa.me/918800339125");
  assert.equal(brand.social.instagram, "https://instagram.com/travaholiccaps");
  assert.equal(brand.social.facebook, "https://facebook.com/profile.php?id=100080234022161");
  assert.equal(brand.assets.footerWordmarkPath, "/images/brand/travaholic-wordmark-black.png");
});

test("DEFAULT_BRAND_PROFILE is the same object the AI pipeline consumes", () => {
  assert.equal(brand.profile, DEFAULT_BRAND_PROFILE);
});

test("validation catches missing/invalid required fields", () => {
  const bad = { ...travaholicBrand, key: "", profile: { ...travaholicBrand.profile, siteUrl: "ftp://x" } };
  const { ok, errors } = validateRetailOsBrand(bad);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.includes("key is required")));
  assert.ok(errors.some((e) => e.includes("siteUrl")));
});

test("fallback: default brand profile keeps stable defaults", () => {
  assert.equal(DEFAULT_BRAND_PROFILE.brandName, "Travaholic");
  assert.equal(DEFAULT_BRAND_PROFILE.productNoun, "trucker cap");
});
