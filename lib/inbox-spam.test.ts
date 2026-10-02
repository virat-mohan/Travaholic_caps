import { test } from "node:test";
import assert from "node:assert/strict";
import { canReplyFreeForm, lastInboundByConversation, normaliseStatus } from "./whatsapp-window.ts";
import { looksLikeGibberish, signFormTimestamp, tokenIsHuman, spamReason } from "./contact-spam.ts";

const now = new Date("2026-10-02T12:00:00Z");
test("free-form reply only within 24h of the customer's last message", () => {
  assert.ok(canReplyFreeForm("2026-10-01T13:00:00Z", now));
  assert.ok(!canReplyFreeForm("2026-10-01T11:59:00Z", now));
  assert.ok(!canReplyFreeForm(null, now));
});
test("last inbound per conversation", () => {
  const m = lastInboundByConversation([
    { conversation_id: "a", created_at: "2026-10-01T10:00:00Z" },
    { conversation_id: "a", created_at: "2026-10-01T12:00:00Z" },
    { conversation_id: "b", created_at: "2026-09-30T12:00:00Z" },
  ]);
  assert.equal(m.a, "2026-10-01T12:00:00Z");
  assert.equal(m.b, "2026-09-30T12:00:00Z");
});
test("status words map to inbox statuses", () => {
  assert.equal(normaliseStatus("DELIVERED"), "delivered");
  assert.equal(normaliseStatus("read"), "read");
  assert.equal(normaliseStatus("failed"), "failed");
  assert.equal(normaliseStatus("sent"), "sent");
  assert.equal(normaliseStatus("queued"), null);
});

const secret = "test-secret";
const T = 1_800_000_000_000;
test("spam sample is dropped", () => {
  assert.ok(looksLikeGibberish("cpTXPJVAcnuLAydzyYMW"));
  assert.equal(spamReason({ name: "cpTXPJVAcnuLAydzyYMW", message: "hBQzKxWmtrNPLdfoAV", token: signFormTimestamp(T - 10000, secret), secret, recentFromIp: 0, now: T }), "gibberish");
});
test("real messages pass", () => {
  for (const s of ["Hi, does the cap fit a large head?", "Priya", "Rahul Sharma", "Kya yeh cap washable hai?", "मुझे दो कैप चाहिए", "Order kab aayega?", "Thanks!", "Christopherson", "Bhattacharya", "Subramaniam", "Chakraborty"]) {
    assert.ok(!looksLikeGibberish(s), s);
  }
  assert.equal(spamReason({ name: "Priya", message: "Hi, does the cap fit a large head?", token: signFormTimestamp(T - 10000, secret), secret, recentFromIp: 0, now: T }), null);
});
test("honeypot, speed, forged token and rate limit", () => {
  const ok = signFormTimestamp(T - 10000, secret);
  const base = { name: "Priya", message: "Hello there", secret, now: T, recentFromIp: 0 };
  assert.equal(spamReason({ ...base, token: ok, honeypot: "x" }), "honeypot");
  assert.equal(spamReason({ ...base, token: signFormTimestamp(T - 1000, secret) }), "too_fast");
  assert.ok(!tokenIsHuman(signFormTimestamp(T - 10000, "other"), secret, T));
  assert.equal(spamReason({ ...base, token: undefined }), "too_fast");
  assert.equal(spamReason({ ...base, token: ok, recentFromIp: 3 }), "rate_limited");
  assert.equal(spamReason({ ...base, token: ok, recentFromIp: 2 }), null);
});
