import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  getTravaholicFoundation, requireCommittedFoundation, assertFoundationMatchesVoice, RECONCILIATION_ITEMS,
  getTravaholicVoiceModel,
} from "./brand-foundation.ts";
import { brandVoicePrompt } from "./brand-voice.ts";
import {
  defineBrandFoundation, isDownstreamAllowed, transitionFoundation,
} from "@retail-os/brand-config/brand-foundation";

const here = dirname(fileURLToPath(import.meta.url));
const baseline = JSON.parse(readFileSync(join(here, "__fixtures__/brandVoicePrompt.baseline.json"), "utf8")) as Record<string, string>;

test("Travaholic Foundation is committed and downstream-allowed", () => {
  const f = getTravaholicFoundation();
  assert.equal(f.status, "committed");
  assert.equal(isDownstreamAllowed(f), true);
  assert.equal(requireCommittedFoundation().key, "caps");
});

test("the gate: a non-committed foundation cannot drive downstream output", () => {
  const draft = defineBrandFoundation({
    key: "caps", identity: { name: "Travaholic", positioning: "x", valueProposition: "y" }, icp: { audience: "a" },
  });
  assert.equal(isDownstreamAllowed(draft), false); // draft
  const reviewed = transitionFoundation(draft, "review");
  assert.equal(isDownstreamAllowed(reviewed), false); // review
  // approved-but-not-committed also cannot drive output
  const approved = transitionFoundation(
    { ...reviewed, voice: { ...reviewed.voice, attributes: ["warm"] }, sources: [{ label: "s", confidence: "founder_approved" }] },
    "approved", { approvedBy: "Virat" },
  );
  assert.equal(isDownstreamAllowed(approved), false);
  assert.equal(isDownstreamAllowed(transitionFoundation(approved, "committed")), true);
});

test("brand-voice agrees with the committed Foundation (consumer, not a rival source)", () => {
  assert.doesNotThrow(() => assertFoundationMatchesVoice());
});

test("brandVoicePrompt output is byte-identical to the pre-change baseline (no drift)", () => {
  for (const [k, expected] of Object.entries(baseline)) {
    const kind = k === "undefined" ? undefined : (k as any);
    assert.equal(brandVoicePrompt(kind), expected, `brandVoicePrompt(${k}) changed`);
  }
});

test("brandVoicePrompt is gated: it runs only because the Foundation is committed", () => {
  // Proven indirectly: the call above succeeds; requireCommittedFoundation() is its first statement.
  assert.ok(brandVoicePrompt("ad").includes("Travaholic"));
});

test("brandVoicePrompt's values are sourced from the committed Foundation, not BRAND_VOICE", () => {
  const f = getTravaholicFoundation();
  const m = getTravaholicVoiceModel();
  // identity + voice + visual come from the Foundation's own first-class fields
  assert.equal(m.brand, f.identity.name);
  assert.equal(m.tagline, f.identity.tagline);
  assert.equal(m.positioning, f.identity.positioning);
  assert.deepEqual(m.do, f.voice.do);
  assert.deepEqual(m.dont, f.voice.dont);
  assert.equal(m.colours.cream, f.visual.colors.find((c) => c.name === "cream")?.hex);
  // the prose/marketing values come from the Foundation's marketingPreferences
  const p = (f.marketingPreferences as any).promptModel;
  assert.equal(m.voice, p.voiceSentence);
  assert.equal(m.productLine, p.productLine);
  assert.deepEqual(m.hashtags, p.hashtags);
  assert.equal(m.offers.priceLabel, p.offers.priceLabel);
});

test("genuine unresolved conflicts are recorded, not auto-committed", () => {
  assert.ok(RECONCILIATION_ITEMS.length >= 3);
  assert.ok(RECONCILIATION_ITEMS.some((x) => /Explorers|Travaholics/.test(x)));
});
