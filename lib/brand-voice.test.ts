import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BRAND_VOICE,
  GAPS,
  checkVoice,
  hasBlock,
  describeBlocks,
  brandVoicePrompt,
  stripHtml,
  voiceGate,
} from "./brand-voice.ts";
import { DEFAULT_BRAND_PROFILE, travaholicBrand } from "./retail-os-brand.ts";
import { SUPPORT_TEMPLATE, renderSupportBody } from "./support-template.ts";
import { renderDiwaliGiftEmail, diwaliSubject } from "./email-templates/diwaligift.ts";
import { renderWelcomeBack15Email } from "./email-templates/welcomeback15.ts";

const rules = (f: ReturnType<typeof checkVoice>, level: "block" | "warn") => f.filter((x) => x.level === level).map((x) => x.rule);

test("module matches the repo's brand config", () => {
  assert.equal(BRAND_VOICE.brand, DEFAULT_BRAND_PROFILE.brandName);
  assert.equal(BRAND_VOICE.tagline, DEFAULT_BRAND_PROFILE.tagline);
  assert.equal(BRAND_VOICE.voice, DEFAULT_BRAND_PROFILE.voice);
  assert.equal(BRAND_VOICE.contact.whatsappHref, travaholicBrand.contact.whatsappHref);
  assert.equal(BRAND_VOICE.contact.email, travaholicBrand.contact.email);
  assert.match(BRAND_VOICE.source, /No written Caps brand book/);
});

test("12 open questions for Ishan are listed, not encoded", () => {
  assert.equal(GAPS.length, 12);
});

test("stale: Cash on Delivery blocks", () => {
  for (const t of ["Cash on Delivery available", "COD available on all orders", "Pay on delivery today"]) {
    const f = checkVoice(t, "whatsapp");
    assert.ok(hasBlock(f), t);
    assert.ok(rules(f, "block").includes("stale-cod"));
  }
  // Saying it is not offered only warns, except in ads.
  assert.ok(!hasBlock(checkVoice("Cash on Delivery is not available; prepaid only.", "email")));
  assert.ok(hasBlock(checkVoice("No COD.", "ad")));
});

test("discount % and codes: ads never, coupons only in their channel", () => {
  assert.ok(hasBlock(checkVoice("Flat 20% off this weekend", "ad")));
  assert.ok(hasBlock(checkVoice("Get 15% off", "social")));
  assert.ok(hasBlock(checkVoice("Use WELCOMEBACK15 at checkout", "whatsapp")));
  assert.ok(hasBlock(checkVoice("Use WELCOMEBACK15", "ad")));
  assert.ok(!hasBlock(checkVoice("Use WELCOMEBACK15 for 15% off", "email", { campaign: "welcomeback15" })));
  assert.ok(hasBlock(checkVoice("Use BUYNOW10 for 10% off", "whatsapp")));
  assert.ok(!hasBlock(checkVoice("Use BUYNOW10 for 10% off", "whatsapp", { campaign: "abandoned_cart" })));
  assert.ok(rules(checkVoice("Try LOYAL10", "whatsapp"), "warn").includes("unknown-coupon"));
});

test("GIFT10: 10% off allowed outside ads, never in ads, other percents still blocked", () => {
  assert.ok(!hasBlock(checkVoice("Use GIFT10 for 10% off your gift order, until 8 Nov.", "social")));
  assert.ok(!hasBlock(checkVoice("Use GIFT10 for 10% off your gift order.", "email")));
  assert.ok(hasBlock(checkVoice("Use GIFT10 for 10% off", "ad")));
  assert.ok(hasBlock(checkVoice("Get 10% off your gift order", "social")));
  assert.ok(hasBlock(checkVoice("Use GIFT10 for 25% off", "social")));
});

test("ads: no sale, no markdown on ₹1,399", () => {
  assert.ok(hasBlock(checkVoice("Big sale on caps", "ad")));
  assert.ok(hasBlock(checkVoice("Now ₹999", "ad")));
  assert.ok(hasBlock(checkVoice("MRP ₹1,999, now ₹1,399", "ad")));
  assert.ok(!hasBlock(checkVoice("₹1,399. Buy 3, Get 1 Free. Free shipping on prepaid orders.", "ad")));
});

test("name, domain and number", () => {
  assert.ok(hasBlock(checkVoice("Shop Travelholic caps", "email")));
  assert.ok(hasBlock(checkVoice("Visit travaholic.com", "social")));
  assert.ok(hasBlock(checkVoice("WhatsApp +1 555 344 0937", "whatsapp")));
});

test("hard sell and shouting warn, never block", () => {
  const f = checkVoice("Hurry, last chance!!", "social");
  assert.ok(!hasBlock(f));
  assert.ok(rules(f, "warn").includes("hard-sell"));
  assert.ok(rules(f, "warn").includes("shouty"));
});

test("express delivery is a warning (open question)", () => {
  const f = checkVoice("Free Express Delivery", "whatsapp");
  assert.ok(!hasBlock(f));
  assert.ok(rules(f, "warn").includes("express-claim"));
});

test("describeBlocks and voiceGate", () => {
  const f = checkVoice("COD available", "whatsapp");
  assert.match(describeBlocks(f), /stale-cod/);
  assert.equal(voiceGate("COD available", "whatsapp", "test").ok, false);
  assert.equal(voiceGate("COD available", "whatsapp", "test", { internal: true }).ok, true);
  assert.equal(voiceGate("COD available", "whatsapp", "test", { transactional: true }).ok, true);
});

test("approved copy passes: support_followup template", () => {
  assert.ok(!hasBlock(checkVoice(SUPPORT_TEMPLATE.body, "whatsapp")), describeBlocks(checkVoice(SUPPORT_TEMPLATE.body, "whatsapp")));
  assert.ok(!hasBlock(checkVoice(renderSupportBody("Riya"), "whatsapp")));
});

test("approved copy passes: WELCOMEBACK15 campaign email", () => {
  const text = stripHtml(renderWelcomeBack15Email("Fri, 3 Oct, 8:00 pm IST", "https://www.travaholic.in/u"));
  const f = checkVoice(`Your next story is 15% off (24 hours only)\n${text}`, "email", { campaign: "welcomeback15" });
  assert.ok(!hasBlock(f), describeBlocks(f));
});

test("approved copy passes: Diwali gifting email, both segments", () => {
  for (const seg of ["past", "incomplete"] as const) {
    const f = checkVoice(`${diwaliSubject(seg, "Riya")}\n${stripHtml(renderDiwaliGiftEmail(seg, "https://www.travaholic.in/u"))}`, "email");
    assert.ok(!hasBlock(f), describeBlocks(f));
  }
});

test("approved copy passes: performance-manager ad messages", () => {
  const src = readFileSync(new URL("./performance-manager.ts", import.meta.url), "utf8");
  const block = src.match(/const DEFAULT_MESSAGES = \[([\s\S]*?)\];/)?.[1] ?? "";
  const messages = [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(messages.length >= 3);
  for (const m of messages) assert.ok(!hasBlock(checkVoice(m, "ad")), `${m}: ${describeBlocks(checkVoice(m, "ad"))}`);
});

test("approved copy passes: DM bot lines", () => {
  const src = readFileSync(new URL("./meta-bot.ts", import.meta.url), "utf8");
  const lines = [...src.matchAll(/sendMessage\(\s*senderId,\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(lines.length >= 3);
  for (const l of lines) assert.ok(!hasBlock(checkVoice(l, "social")), l);
});

test("approved copy passes: WhatsApp cart reply (express only warns)", () => {
  const caption =
    "Hi Riya! 🧢 Thanks for choosing Travaholic.\n\n📦 *Order Summary:*\n1x Dunes Yellow\n\n💰 *Total Amount:* ₹1,399 (Free Express Delivery)\n\nYour cart is ready — tap below to complete your order securely on our site:\nhttps://www.travaholic.in/cart";
  assert.ok(!hasBlock(checkVoice(caption, "whatsapp")));
});

test("brandVoicePrompt carries the rules", () => {
  const p = brandVoicePrompt("ad");
  assert.match(p, /Stories You Can Wear/);
  assert.match(p, /Buy 3, Get 1 Free/);
  assert.match(p, /Cash on Delivery/);
  assert.match(brandVoicePrompt("image"), /exact real product/);
});
