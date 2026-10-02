// Contact-form spam rules. Pure functions so they are unit-tested.
import { createHmac, timingSafeEqual } from "node:crypto";

export const MIN_SUBMIT_MS = 3000;
export const RATE_LIMIT = { max: 3, windowMs: 10 * 60 * 1000 };

export function signFormTimestamp(ts: number, secret: string): string {
  const mac = createHmac("sha256", secret).update(`contact:${ts}`).digest("hex").slice(0, 32);
  return `${ts}.${mac}`;
}

/** True when the token is genuine and at least MIN_SUBMIT_MS old (and under a day). */
export function tokenIsHuman(token: unknown, secret: string, now = Date.now()): boolean {
  if (typeof token !== "string" || !token.includes(".")) return false;
  const ts = Number(token.split(".")[0]);
  if (!Number.isFinite(ts)) return false;
  const expected = signFormTimestamp(ts, secret);
  const a = Buffer.from(expected), b = Buffer.from(token);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const age = now - ts;
  return age >= MIN_SUBMIT_MS && age < 24 * 60 * 60 * 1000;
}

/**
 * Conservative gibberish test for a name or message. Only flags text that is
 * one long run of Latin letters with no spaces AND looks random: several
 * upper/lower case flips inside the word, or almost no vowels. Anything with
 * a space, digits, punctuation or non-Latin script (Hindi) passes.
 */
export function looksLikeGibberish(text: string): boolean {
  const t = text.trim();
  if (!/^[A-Za-z]{12,}$/.test(t)) return false;
  const flips = (t.slice(1).match(/[a-z][A-Z]|[A-Z][a-z]/g) ?? []).length;
  const caseRandom = flips >= 4;
  const vowels = (t.match(/[aeiouAEIOU]/g) ?? []).length / t.length;
  const consonantRun = /[^aeiouAEIOU]{6,}/.test(t);
  return caseRandom || vowels < 0.2 || consonantRun;
}

export type SpamReason = "honeypot" | "too_fast" | "gibberish" | "rate_limited" | null;

export function spamReason(input: {
  name: string; message: string; honeypot?: unknown; token?: unknown;
  secret: string; recentFromIp: number; now?: number;
}): SpamReason {
  if (typeof input.honeypot === "string" && input.honeypot.trim()) return "honeypot";
  if (!tokenIsHuman(input.token, input.secret, input.now)) return "too_fast";
  if (looksLikeGibberish(input.name) || looksLikeGibberish(input.message)) return "gibberish";
  if (input.recentFromIp >= RATE_LIMIT.max) return "rate_limited";
  return null;
}

/** Server-only HMAC key for the form timestamp (never sent to the browser). */
export function contactSecret(): string {
  return process.env.CONTACT_FORM_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "contact-form";
}
