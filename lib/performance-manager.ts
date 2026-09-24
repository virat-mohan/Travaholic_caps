import { getSupabaseServerClient } from "@/lib/supabase";
import { getSetting, setSetting } from "@/lib/settings";
import { getBrandProfile } from "@/lib/brand";
import { sendEmail } from "@/lib/email";
import { sendWhatsAppSessionMessage } from "@/lib/msg91";
import {
  type AdSetInsightRow,
  type ManagedTargeting,
  getAdSetInsightsDaily,
  listCampaigns,
  listAdSets,
  setAdSetStatus,
  setCampaignStatus,
  setCampaignDailyBudgetRupees,
  getCampaignDailyBudgetRupees,
  createCustomerListAudience,
  createWebsiteAudience,
  createInstagramEngagersAudience,
  createLookalikeAudience,
  getAudienceSizes,
  normalizeCustomerRecord,
  createSalesCampaignCBO,
  createPurchaseAdSet,
  createCatalogAd,
  createExistingInstagramPostAd,
  getAdSetFlexibleSpec,
  searchInterests,
  getMetaMarketingAuth,
} from "@/lib/meta-marketing";

// ============================================================
// Performance Marketing Manager — the "media buyer" for the account.
//
// Everything money-related is deterministic rules over Meta-attributed
// purchase ROAS (the same number Ads Manager shows), evaluated on complete
// account-timezone days, never on a half-day of data:
//   - Kill:   an ad set under PM_TARGET_ROAS for 3 consecutive days → paused
//   - Kill:   ₹1,000+ spent over 7 days with zero purchases → paused
//   - Scale:  managed campaign ≥ 1.25× target over 3 days with ≥ 3 purchases
//             → CBO budget +20%, never above PM_DAILY_BUDGET_CAP_RUPEES
//   - Halt:   blended managed ROAS under target for 3 consecutive days →
//             campaign paused, owner alerted, next experiment queued
//   - Refill: fewer than 3 active managed ad sets → launch the next queued
//             experiment (audience/creative idea) so the account keeps
//             testing rather than sitting still
//
// Claude only ever proposes EXPERIMENTS (audiences, creatives, copy angles)
// — it never decides budgets or pauses. State lives in the PM_STATE setting
// as JSON so this runs today without a schema migration; it's small (a few
// ad sets × days) and trimmed on every write.
// ============================================================

const DEFAULT_CAP_RUPEES = 500;
const DEFAULT_TARGET_ROAS = 4;
const KILL_CONSECUTIVE_DAYS = 3;
const MIN_DAILY_SPEND_TO_JUDGE = 100;
const ZERO_PURCHASE_KILL_SPEND_7D = 1000;
const SCALE_MULTIPLIER = 1.2;
const SCALE_TRIGGER_ROAS_FACTOR = 1.25;
const SCALE_MIN_PURCHASES_3D = 3;
const TARGET_ACTIVE_ADSETS = 3;
const SNAPSHOT_RETENTION_DAYS = 120;

export type PmAction = {
  at: string;
  entityType: "campaign" | "adset" | "audience" | "experiment" | "system";
  entityId: string | null;
  entityName: string;
  action: string;
  reason: string;
  before?: string;
  after?: string;
};

export type PmExperiment = {
  id: string;
  name: string;
  hypothesis: string;
  targetingKind: "interests" | "lookalike" | "retargeting" | "broad";
  interestKeywords?: string[];
  audienceKeys?: string[];
  excludeAudienceKeys?: string[];
  ageMin: number;
  ageMax: number;
  genders?: (1 | 2)[];
  advantageAudience?: boolean;
  creativeKind: "catalog" | "ig_post";
  igMediaId?: string;
  messages: string[];
  status: "planned" | "running" | "paused" | "won" | "lost" | "blocked";
  adsetId?: string;
  adIds?: string[];
  createdAt: string;
  launchedAt?: string;
  endedAt?: string;
  resultNote?: string;
  source: "bootstrap" | "claude" | "manual";
};

export type PmState = {
  snapshots: AdSetInsightRow[];
  actions: PmAction[];
  experiments: PmExperiment[];
  suggestions: { at: string; text: string }[];
  halted: boolean;
  lastSweepAt?: string;
  lastDigestDate?: string;
  lastIdeasDate?: string;
  productSetId?: string;
  landingUrl?: string;
};

const EMPTY_STATE: PmState = { snapshots: [], actions: [], experiments: [], suggestions: [], halted: false };

export async function getPmState(): Promise<PmState> {
  const raw = await getSetting("PM_STATE");
  if (!raw) return { ...EMPTY_STATE };
  try {
    return { ...EMPTY_STATE, ...(JSON.parse(raw) as Partial<PmState>) };
  } catch {
    return { ...EMPTY_STATE };
  }
}

async function savePmState(state: PmState) {
  const cutoff = new Date(Date.now() - SNAPSHOT_RETENTION_DAYS * 86400000).toISOString().slice(0, 10);
  state.snapshots = state.snapshots.filter((s) => s.date >= cutoff);
  state.actions = state.actions.slice(-500);
  state.suggestions = state.suggestions.slice(-30);
  await setSetting("PM_STATE", JSON.stringify(state));
}

export async function getPmConfig() {
  const [enabled, cap, target, managedRaw, audiencesRaw, alertWa, alertEmail, copyRules, warehouseEmail] = await Promise.all([
    getSetting("PM_ENABLED"),
    getSetting("PM_DAILY_BUDGET_CAP_RUPEES"),
    getSetting("PM_TARGET_ROAS"),
    getSetting("PM_MANAGED_CAMPAIGN_IDS"),
    getSetting("PM_AUDIENCES"),
    getSetting("PM_ALERT_WHATSAPP"),
    getSetting("PM_ALERT_EMAIL"),
    getSetting("PM_COPY_RULES"),
    getSetting("WAREHOUSE_EMAIL"),
  ]);
  let managedCampaignIds: string[] = [];
  try {
    managedCampaignIds = managedRaw ? (JSON.parse(managedRaw) as string[]) : [];
  } catch {
    managedCampaignIds = [];
  }
  let audiences: Record<string, string> = {};
  try {
    audiences = audiencesRaw ? (JSON.parse(audiencesRaw) as Record<string, string>) : {};
  } catch {
    audiences = {};
  }
  return {
    enabled: enabled === "true",
    capRupees: cap ? Number(cap) : DEFAULT_CAP_RUPEES,
    targetRoas: target ? Number(target) : DEFAULT_TARGET_ROAS,
    managedCampaignIds,
    audiences,
    alertWhatsApp: alertWa ?? null,
    alertEmails: (alertEmail || warehouseEmail || "")
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean),
    copyRules:
      copyRules ??
      "Never mention discount percentages or 'sale'. Never encourage Cash on Delivery. Always lead with free shipping on prepaid orders. The only offer that exists is Buy 3 Get 1 Free (applied automatically at checkout). Prices are fixed at ₹1,399 — never imply a markdown.",
  };
}

function nowIso() {
  return new Date().toISOString();
}

function istDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function log(state: PmState, action: Omit<PmAction, "at">) {
  state.actions.push({ at: nowIso(), ...action });
}

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

// ---------------- Audiences ----------------

const AUDIENCE_KEYS = {
  pastAll: "TRAV | Past Customers — All",
  pastDelivered: "TRAV | Past Customers — Delivered",
  purchasers180: "TRAV | Website Purchasers 180D",
  atc30: "TRAV | Add To Cart 30D",
  visitors30: "TRAV | Website Visitors 30D",
  igEngagers365: "TRAV | Instagram Engagers 365D",
  lalPast1: "TRAV | LAL 1% Past Customers",
  lalPast3: "TRAV | LAL 1-3% Past Customers",
  lalIg1: "TRAV | LAL 1% IG Engagers",
} as const;

type AudienceKey = keyof typeof AUDIENCE_KEYS;

async function fetchPastCustomerRecords() {
  const supabase = getSupabaseServerClient();
  const [{ data: legacy }, { data: orders }] = await Promise.all([
    supabase.from("legacy_customers").select("phone, name, email, city, state, pincode, total_delivered_orders"),
    supabase.from("orders").select("customer_phone, customer_name, customer_email, delivery_city, delivery_state, delivery_pincode, status"),
  ]);
  const all = new Map<string, ReturnType<typeof normalizeCustomerRecord>>();
  const delivered = new Map<string, ReturnType<typeof normalizeCustomerRecord>>();
  for (const l of legacy ?? []) {
    const rec = normalizeCustomerRecord({ email: l.email, phone: l.phone, firstName: l.name, city: l.city, state: l.state, zip: l.pincode });
    const key = rec.phone ?? rec.email ?? "";
    if (!key) continue;
    all.set(key, rec);
    if ((l.total_delivered_orders ?? 0) > 0) delivered.set(key, rec);
  }
  for (const o of orders ?? []) {
    if (o.status === "cancelled") continue;
    const rec = normalizeCustomerRecord({
      email: o.customer_email,
      phone: o.customer_phone,
      firstName: o.customer_name,
      city: o.delivery_city,
      state: o.delivery_state,
      zip: o.delivery_pincode,
    });
    const key = rec.phone ?? rec.email ?? "";
    if (!key) continue;
    all.set(key, rec);
    delivered.set(key, rec);
  }
  return { all: [...all.values()], delivered: [...delivered.values()] };
}

/** Creates every audience asset the account is missing (idempotent — keys already in PM_AUDIENCES are skipped). Lookalikes are retried on later sweeps if the seed is still too small for Meta. */
export async function ensureAudiences(state: PmState): Promise<Record<string, string>> {
  const config = await getPmConfig();
  const auth = await getMetaMarketingAuth();
  const audiences = { ...config.audiences };

  const create = async (key: AudienceKey, fn: () => Promise<string>) => {
    if (audiences[key]) return;
    try {
      audiences[key] = await fn();
      log(state, { entityType: "audience", entityId: audiences[key], entityName: AUDIENCE_KEYS[key], action: "created", reason: "Missing audience asset needed for the ICP (men 18–44, past buyers, warm traffic)." });
    } catch (err) {
      log(state, { entityType: "audience", entityId: null, entityName: AUDIENCE_KEYS[key], action: "create_failed", reason: err instanceof Error ? err.message.slice(0, 300) : "unknown error" });
    }
  };

  if (!audiences.pastAll || !audiences.pastDelivered) {
    const records = await fetchPastCustomerRecords();
    await create("pastAll", () => createCustomerListAudience(AUDIENCE_KEYS.pastAll, `${records.all.length} past customers (legacy platform + current site)`, records.all));
    await create("pastDelivered", () =>
      createCustomerListAudience(AUDIENCE_KEYS.pastDelivered, `${records.delivered.length} customers with at least one delivered order`, records.delivered)
    );
  }
  if (auth.pixelId) {
    await create("purchasers180", () => createWebsiteAudience(AUDIENCE_KEYS.purchasers180, auth.pixelId!, 180, "Purchase"));
    await create("atc30", () => createWebsiteAudience(AUDIENCE_KEYS.atc30, auth.pixelId!, 30, "AddToCart"));
    await create("visitors30", () => createWebsiteAudience(AUDIENCE_KEYS.visitors30, auth.pixelId!, 30, null));
  }
  if (auth.igUserId) {
    await create("igEngagers365", () => createInstagramEngagersAudience(AUDIENCE_KEYS.igEngagers365, auth.igUserId!, 365));
  }
  // Lookalikes need a populated seed — a customer list takes Meta up to an
  // hour to match, so these commonly fail on the very first run and succeed
  // on the next sweep. Delivered buyers are the better seed when large
  // enough; fall back to the full list otherwise.
  const seed = audiences.pastDelivered ?? audiences.pastAll;
  if (seed) {
    await create("lalPast1", () => createLookalikeAudience(AUDIENCE_KEYS.lalPast1, seed, 0.01));
    await create("lalPast3", () => createLookalikeAudience(AUDIENCE_KEYS.lalPast3, seed, 0.03));
  }
  if (audiences.igEngagers365) {
    await create("lalIg1", () => createLookalikeAudience(AUDIENCE_KEYS.lalIg1, audiences.igEngagers365, 0.01));
  }

  await setSetting("PM_AUDIENCES", JSON.stringify(audiences));
  return audiences;
}

// ---------------- Experiments ----------------

const DEFAULT_MESSAGES = [
  "Free shipping on every prepaid order. Trucker caps with a real story behind each one — pick yours.",
  "Buy 3, get 1 free — applied automatically at checkout. Free shipping when you pay online.",
  "Stories you can wear. Premium trucker caps inspired by real journeys. Free shipping on prepaid orders.",
];

function bootstrapExperiments(): PmExperiment[] {
  const at = nowIso();
  return [
    {
      id: newId(),
      name: "Interests | Streetwear + Travel | Men 18-44",
      hypothesis:
        "The only ad set since Sept 15 above 2x (2.65x, CTR 2.7%) was the streetwear/baseball-cap/travel interest stack — but it wasted spend on women and 45+. Same interests, restricted to the ICP (men 18–44), should clear 4x.",
      targetingKind: "interests",
      interestKeywords: ["Streetwear", "Baseball cap", "Hat", "Travel", "Adventure travel", "Hip hop fashion"],
      excludeAudienceKeys: ["pastAll", "purchasers180"],
      ageMin: 18,
      ageMax: 44,
      genders: [1],
      creativeKind: "catalog",
      messages: DEFAULT_MESSAGES,
      status: "planned",
      createdAt: at,
      source: "bootstrap",
    },
    {
      id: newId(),
      name: "Lookalike 1-3% | Past Customers | Men 18-44",
      hypothesis:
        "1,800 past buyers are the strongest signal this account has and have never been used as a seed. A 1–3% lookalike of them, men 18–44, mirrors the campaigns that historically ran at 4.5–4.9x.",
      targetingKind: "lookalike",
      audienceKeys: ["lalPast3", "lalPast1"],
      excludeAudienceKeys: ["pastAll", "purchasers180"],
      ageMin: 18,
      ageMax: 44,
      genders: [1],
      creativeKind: "catalog",
      messages: DEFAULT_MESSAGES,
      status: "planned",
      createdAt: at,
      source: "bootstrap",
    },
    {
      id: newId(),
      name: "Retargeting | Visitors 30D + IG Engagers + ATC | 18-54",
      hypothesis:
        "430 page views, 18 add-to-carts and 20 checkout starts in 9 days with only 5 orders — warm traffic is leaking. A small retargeting ad set (excluding purchasers) is the cheapest ROAS in any account.",
      targetingKind: "retargeting",
      audienceKeys: ["visitors30", "atc30", "igEngagers365"],
      excludeAudienceKeys: ["purchasers180"],
      ageMin: 18,
      ageMax: 54,
      creativeKind: "catalog",
      messages: [
        "Still thinking about it? Free shipping on prepaid orders — and Buy 3, Get 1 Free is applied automatically.",
        ...DEFAULT_MESSAGES.slice(0, 2),
      ],
      status: "planned",
      createdAt: at,
      source: "bootstrap",
    },
    {
      id: newId(),
      name: "Advantage+ Broad | Men 18-44",
      hypothesis:
        "Once the pixel has fresh purchase signal from the ad sets above, Meta's own audience expansion restricted to men 18–44 is the usual next scale lever.",
      targetingKind: "broad",
      excludeAudienceKeys: ["pastAll", "purchasers180"],
      ageMin: 18,
      ageMax: 44,
      genders: [1],
      advantageAudience: true,
      creativeKind: "catalog",
      messages: DEFAULT_MESSAGES,
      status: "planned",
      createdAt: at,
      source: "bootstrap",
    },
    {
      id: newId(),
      name: "UGC Reel | Melbourne beach (best-engaged reel) | Men 18-44",
      hypothesis:
        "The account's best-engaged organic content is real customers travelling in the caps (the Melbourne beach reel: 66 likes / 16 comments). Boosting it as a Shop Now ad brings social proof the catalog ad lacks.",
      targetingKind: "interests",
      interestKeywords: ["Travel", "Adventure travel", "Backpacking (travel)", "Streetwear"],
      excludeAudienceKeys: ["pastAll", "purchasers180"],
      ageMin: 18,
      ageMax: 44,
      genders: [1],
      creativeKind: "ig_post",
      igMediaId: "17987760878620534",
      messages: DEFAULT_MESSAGES,
      status: "planned",
      createdAt: at,
      source: "bootstrap",
    },
  ];
}

async function resolveInterestSpec(keywords: string[]) {
  const interests: { id: string; name: string }[] = [];
  for (const kw of keywords) {
    try {
      const found = await searchInterests(kw, 3);
      const exact = found.find((f) => f.name.toLowerCase() === kw.toLowerCase()) ?? found[0];
      if (exact && !interests.some((i) => i.id === exact.id)) interests.push({ id: exact.id, name: exact.name });
    } catch {
      // skip unresolvable keyword
    }
  }
  return interests;
}

async function launchExperiment(state: PmState, exp: PmExperiment, campaignId: string, audiences: Record<string, string>) {
  const includeIds = (exp.audienceKeys ?? []).map((k) => audiences[k]).filter(Boolean);
  const excludeIds = (exp.excludeAudienceKeys ?? []).map((k) => audiences[k]).filter(Boolean);
  if ((exp.targetingKind === "lookalike" || exp.targetingKind === "retargeting") && includeIds.length === 0) {
    exp.status = "blocked";
    exp.resultNote = "Required audiences aren't created yet — will retry on the next sweep.";
    return false;
  }

  let flexibleSpec: ManagedTargeting["flexibleSpec"];
  if (exp.targetingKind === "interests") {
    const interests = await resolveInterestSpec(exp.interestKeywords ?? []);
    if (interests.length === 0) {
      exp.status = "blocked";
      exp.resultNote = "None of the interest keywords resolved in Meta's interest graph.";
      return false;
    }
    flexibleSpec = [{ interests }];
  }

  const targeting: ManagedTargeting = {
    ageMin: exp.ageMin,
    ageMax: exp.ageMax,
    genders: exp.genders,
    flexibleSpec,
    customAudienceIds: includeIds.length ? includeIds : undefined,
    excludedCustomAudienceIds: excludeIds.length ? excludeIds : undefined,
    advantageAudience: exp.advantageAudience ?? false,
  };

  const productSetId = state.productSetId;
  const landingUrl = state.landingUrl ?? "https://travaholic.in/";
  const adsetId = await createPurchaseAdSet({
    campaignId,
    name: `PM | ${exp.name}`,
    targeting,
    status: "ACTIVE",
    productSetId: exp.creativeKind === "catalog" ? productSetId : undefined,
  });
  exp.adsetId = adsetId;
  exp.adIds = [];

  if (exp.creativeKind === "catalog") {
    if (!productSetId) throw new Error("productSetId missing in PM state");
    const ad = await createCatalogAd({ adsetId, name: `PM | Catalog | ${exp.name}`, productSetId, messages: exp.messages, link: landingUrl, status: "ACTIVE" });
    exp.adIds.push(ad.adId);
  } else if (exp.creativeKind === "ig_post" && exp.igMediaId) {
    const ad = await createExistingInstagramPostAd({ adsetId, name: `PM | UGC Post | ${exp.name}`, igMediaId: exp.igMediaId, link: landingUrl, status: "ACTIVE" });
    exp.adIds.push(ad.adId);
  }

  exp.status = "running";
  exp.launchedAt = nowIso();
  exp.resultNote = undefined;
  log(state, { entityType: "adset", entityId: adsetId, entityName: exp.name, action: "launched", reason: exp.hypothesis });
  return true;
}

async function refillActiveSlots(state: PmState, campaignId: string, audiences: Record<string, string>, max = TARGET_ACTIVE_ADSETS) {
  let running = state.experiments.filter((e) => e.status === "running").length;
  for (const exp of state.experiments) {
    if (running >= max) break;
    if (exp.status !== "planned" && exp.status !== "blocked") continue;
    try {
      if (await launchExperiment(state, exp, campaignId, audiences)) running += 1;
    } catch (err) {
      exp.status = "blocked";
      exp.resultNote = err instanceof Error ? err.message.slice(0, 300) : "launch failed";
      log(state, { entityType: "experiment", entityId: exp.id, entityName: exp.name, action: "launch_failed", reason: exp.resultNote });
    }
  }
}

// ---------------- Bootstrap (run once) ----------------

/**
 * Builds the audience assets and launches the first managed campaign at the
 * budget cap. Safe to re-run: existing audiences/campaign are reused, only
 * missing pieces are created.
 */
export async function bootstrapPerformanceProgram(input?: { productSetId?: string; landingUrl?: string }) {
  const config = await getPmConfig();
  const state = await getPmState();
  const brand = await getBrandProfile();

  if (input?.productSetId) state.productSetId = input.productSetId;
  if (input?.landingUrl) state.landingUrl = input.landingUrl;
  if (!state.landingUrl) state.landingUrl = brand.siteUrl;
  if (!state.productSetId) {
    // Reuse whichever product set the account's most recent catalog ad set promotes.
    const auth = await getMetaMarketingAuth();
    const { graphGet } = await import("@/lib/meta-marketing");
    const recent = await graphGet<{ data: { promoted_object?: { product_set_id?: string } }[] }>(`${auth.account}/adsets`, auth.accessToken, {
      fields: "promoted_object",
      limit: "50",
    });
    const found = (recent.data ?? []).map((a) => a.promoted_object?.product_set_id).find(Boolean);
    if (!found) throw new Error("No product set found — pass productSetId explicitly");
    state.productSetId = found;
  }

  const audiences = await ensureAudiences(state);

  let campaignId = config.managedCampaignIds[0];
  if (!campaignId) {
    campaignId = await createSalesCampaignCBO(`${brand.brandName} | PM | Prospecting | ${istDate()}`, config.capRupees, "ACTIVE");
    await setSetting("PM_MANAGED_CAMPAIGN_IDS", JSON.stringify([campaignId]));
    log(state, { entityType: "campaign", entityId: campaignId, entityName: "PM Prospecting", action: "created", reason: `CBO sales campaign at ₹${config.capRupees}/day cap, purchase-optimised, 7-day click / 1-day view attribution.`, after: `₹${config.capRupees}/day` });
  }

  if (state.experiments.length === 0) state.experiments = bootstrapExperiments();
  await refillActiveSlots(state, campaignId, audiences);

  state.halted = false;
  await savePmState(state);
  return { campaignId, audiences, experiments: state.experiments, actions: state.actions.slice(-20) };
}

// ---------------- Daily sweep ----------------

type AdSetDay = { date: string; spend: number; purchases: number; purchaseValue: number; roas: number | null };

function byAdset(rows: AdSetInsightRow[]) {
  const map = new Map<string, { name: string; campaignId: string; campaignName: string; days: AdSetDay[] }>();
  for (const r of rows) {
    const e = map.get(r.adsetId) ?? { name: r.adsetName, campaignId: r.campaignId, campaignName: r.campaignName, days: [] };
    e.days.push({ date: r.date, spend: r.spend, purchases: r.purchases, purchaseValue: r.purchaseValue, roas: r.roas });
    map.set(r.adsetId, e);
  }
  for (const e of map.values()) e.days.sort((a, b) => (a.date < b.date ? 1 : -1));
  return map;
}

function consecutiveDaysBelow(days: AdSetDay[], target: number) {
  let n = 0;
  for (const d of days) {
    if (d.spend < MIN_DAILY_SPEND_TO_JUDGE) break;
    if ((d.roas ?? 0) < target) n += 1;
    else break;
  }
  return n;
}

function sumWindow(days: AdSetDay[], n: number) {
  const w = days.slice(0, n);
  const spend = w.reduce((s, d) => s + d.spend, 0);
  const value = w.reduce((s, d) => s + d.purchaseValue, 0);
  const purchases = w.reduce((s, d) => s + d.purchases, 0);
  return { spend, value, purchases, roas: spend > 0 ? value / spend : null };
}

export async function runPerformanceSweep() {
  const config = await getPmConfig();
  const state = await getPmState();
  state.lastSweepAt = nowIso();

  const yesterday = istDate(-1);
  const since = istDate(-8);
  const rows = await getAdSetInsightsDaily(since, yesterday);

  // Upsert managed snapshots (keyed adset+date).
  const managedRows = rows.filter((r) => config.managedCampaignIds.includes(r.campaignId));
  const key = (r: AdSetInsightRow) => `${r.adsetId}|${r.date}`;
  const existing = new Map(state.snapshots.map((s) => [key(s), s]));
  for (const r of managedRows) existing.set(key(r), r);
  state.snapshots = [...existing.values()];

  const decisions: string[] = [];
  const campaignId = config.managedCampaignIds[0];

  if (!config.enabled) {
    decisions.push("PM_ENABLED is not 'true' — reporting only, no changes made.");
  } else if (campaignId) {
    const audiences = await ensureAudiences(state);
    const groups = byAdset(state.snapshots.filter((s) => s.campaignId === campaignId));
    const liveAdSets = await listAdSets([campaignId]);

    // 1. Ad-set kill rules
    for (const [adsetId, g] of groups) {
      const live = liveAdSets.find((a) => a.id === adsetId);
      if (!live || live.effectiveStatus !== "ACTIVE") continue;
      const exp = state.experiments.find((e) => e.adsetId === adsetId);
      const below = consecutiveDaysBelow(g.days, config.targetRoas);
      const w7 = sumWindow(g.days, 7);
      let reason: string | null = null;
      if (below >= KILL_CONSECUTIVE_DAYS) {
        reason = `${below} consecutive days under ${config.targetRoas}x ROAS (last 3 days: ${g.days
          .slice(0, 3)
          .map((d) => `${d.date} ₹${d.spend} → ${d.roas ?? 0}x`)
          .join(", ")}).`;
      } else if (w7.spend >= ZERO_PURCHASE_KILL_SPEND_7D && w7.purchases === 0) {
        reason = `₹${w7.spend} spent over 7 days with zero purchases.`;
      }
      if (reason) {
        await setAdSetStatus(adsetId, "PAUSED");
        if (exp) {
          exp.status = "lost";
          exp.endedAt = nowIso();
          exp.resultNote = reason;
        }
        log(state, { entityType: "adset", entityId: adsetId, entityName: g.name, action: "paused", reason, before: "ACTIVE", after: "PAUSED" });
        decisions.push(`Paused "${g.name}": ${reason}`);
      }
    }

    // 2. Campaign-level blended guard + scale
    const managedDays = new Map<string, AdSetDay>();
    for (const g of groups.values()) {
      for (const d of g.days) {
        const m = managedDays.get(d.date) ?? { date: d.date, spend: 0, purchases: 0, purchaseValue: 0, roas: null };
        m.spend += d.spend;
        m.purchases += d.purchases;
        m.purchaseValue += d.purchaseValue;
        m.roas = m.spend > 0 ? Number((m.purchaseValue / m.spend).toFixed(2)) : null;
        managedDays.set(d.date, m);
      }
    }
    const blendedDays = [...managedDays.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
    const blendedBelow = consecutiveDaysBelow(blendedDays, config.targetRoas);
    const w3 = sumWindow(blendedDays, 3);
    const currentBudget = (await getCampaignDailyBudgetRupees(campaignId)) ?? config.capRupees;

    if (currentBudget > config.capRupees) {
      await setCampaignDailyBudgetRupees(campaignId, config.capRupees);
      log(state, { entityType: "campaign", entityId: campaignId, entityName: "PM Prospecting", action: "budget_capped", reason: "Budget was above the configured cap.", before: `₹${currentBudget}`, after: `₹${config.capRupees}` });
      decisions.push(`Budget pulled back to the ₹${config.capRupees}/day cap.`);
    }

    if (blendedBelow >= KILL_CONSECUTIVE_DAYS) {
      await setCampaignStatus(campaignId, "PAUSED");
      state.halted = true;
      for (const e of state.experiments) {
        if (e.status === "running") {
          e.status = "paused";
          e.resultNote = "Campaign halted: blended ROAS under target 3 days running.";
        }
      }
      const reason = `Blended managed ROAS under ${config.targetRoas}x for ${blendedBelow} consecutive days — campaign paused. Next queued experiment will relaunch on the following sweep.`;
      log(state, { entityType: "campaign", entityId: campaignId, entityName: "PM Prospecting", action: "halted", reason, before: "ACTIVE", after: "PAUSED" });
      decisions.push(reason);
    } else if (state.halted) {
      // Relaunch with the next idea rather than sitting idle.
      await setCampaignStatus(campaignId, "ACTIVE");
      state.halted = false;
      log(state, { entityType: "campaign", entityId: campaignId, entityName: "PM Prospecting", action: "resumed", reason: "Relaunching with the next queued experiments after a halt.", before: "PAUSED", after: "ACTIVE" });
      decisions.push("Campaign resumed with fresh experiments after halt.");
    } else if (w3.purchases >= SCALE_MIN_PURCHASES_3D && (w3.roas ?? 0) >= config.targetRoas * SCALE_TRIGGER_ROAS_FACTOR && currentBudget < config.capRupees) {
      const next = Math.min(Math.round(currentBudget * SCALE_MULTIPLIER), config.capRupees);
      await setCampaignDailyBudgetRupees(campaignId, next);
      log(state, { entityType: "campaign", entityId: campaignId, entityName: "PM Prospecting", action: "budget_increased", reason: `3-day ROAS ${(w3.roas ?? 0).toFixed(2)}x on ${w3.purchases} purchases.`, before: `₹${currentBudget}`, after: `₹${next}` });
      decisions.push(`Budget scaled ₹${currentBudget} → ₹${next} (3-day ROAS ${(w3.roas ?? 0).toFixed(2)}x).`);
    }

    // 3. Keep testing: fill empty slots from the queue (generate new ideas when the queue runs dry or weekly).
    if (!state.halted) {
      const planned = state.experiments.filter((e) => e.status === "planned" || e.status === "blocked").length;
      const monday = new Date().toLocaleDateString("en-US", { timeZone: "Asia/Kolkata", weekday: "short" }) === "Mon";
      if (planned === 0 || (monday && state.lastIdeasDate !== istDate())) {
        try {
          await generateExperimentIdeas(state, config);
        } catch (err) {
          log(state, { entityType: "system", entityId: null, entityName: "ideas", action: "ideas_failed", reason: err instanceof Error ? err.message.slice(0, 300) : "unknown" });
        }
      }
      await refillActiveSlots(state, campaignId, audiences);
    }
  } else {
    decisions.push("No managed campaign yet — run Bootstrap from /admin/performance.");
  }

  // 4. Daily report (once per IST day).
  const today = istDate();
  if (state.lastDigestDate !== today) {
    try {
      await sendDailyReport(state, config, rows, decisions);
      state.lastDigestDate = today;
    } catch (err) {
      log(state, { entityType: "system", entityId: null, entityName: "digest", action: "digest_failed", reason: err instanceof Error ? err.message.slice(0, 300) : "unknown" });
    }
  }

  await savePmState(state);
  return { decisions, actions: state.actions.slice(-15), halted: state.halted };
}

// ---------------- Ideas (Claude) ----------------

const IDEAS_TOOL = {
  name: "submit_experiments",
  description: "Submit 3 new audience/creative experiments plus 3-5 concrete suggestions (keywords, image angles, reels to reuse). Call exactly once as your final action.",
  input_schema: {
    type: "object" as const,
    properties: {
      experiments: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            hypothesis: { type: "string" },
            targetingKind: { type: "string", enum: ["interests", "lookalike", "retargeting", "broad"] },
            interestKeywords: { type: "array", items: { type: "string" }, description: "Exact Meta interest names to search for (only for targetingKind=interests)" },
            audienceKeys: { type: "array", items: { type: "string", enum: ["pastAll", "pastDelivered", "purchasers180", "atc30", "visitors30", "igEngagers365", "lalPast1", "lalPast3", "lalIg1"] } },
            ageMin: { type: "number" },
            ageMax: { type: "number" },
            menOnly: { type: "boolean" },
            creativeKind: { type: "string", enum: ["catalog"] },
            messages: { type: "array", minItems: 2, maxItems: 4, items: { type: "string" }, description: "Primary text variants obeying the copy rules exactly" },
          },
          required: ["name", "hypothesis", "targetingKind", "ageMin", "ageMax", "menOnly", "creativeKind", "messages"],
        },
      },
      suggestions: { type: "array", minItems: 3, maxItems: 5, items: { type: "string" } },
    },
    required: ["experiments", "suggestions"],
  },
};

export async function generateExperimentIdeas(state: PmState, config: Awaited<ReturnType<typeof getPmConfig>>) {
  const apiKey = await getSetting("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  const brand = await getBrandProfile();

  const won = state.experiments.filter((e) => e.status === "won" || e.status === "running");
  const lost = state.experiments.filter((e) => e.status === "lost");
  const recent = state.snapshots.slice(-60);
  const perf = [...byAdset(recent).entries()]
    .map(([id, g]) => {
      const w = sumWindow(g.days, 7);
      return `- ${g.name} (${id}): 7d spend ₹${w.spend}, ${w.purchases} purchases, ROAS ${w.roas ? w.roas.toFixed(2) : "0"}x`;
    })
    .join("\n");

  const prompt = `You are a senior performance marketer running Meta Ads for ${brand.brandName} (${brand.siteUrl}), a premium Indian D2C trucker-cap brand, ₹1,399 per cap, ships across India. Hard target: ROAS ≥ ${config.targetRoas}x on a ₹${config.capRupees}/day budget.

WHAT THE DATA SAYS (24 months of account history, Meta-attributed):
- Buyers are overwhelmingly men 18–44 (25–34 M 3.7x, 18–24 M 4.0x, 35–44 M 3.6x). Women < 1x. 45+ < 1.7x. Never target women or 45+ for prospecting.
- Catalog (dynamic product) ads with purchase optimisation have hit 4.5–4.9x at scale; static AI-generated banners got 10% CTR and ZERO purchases (clickbait). Real customer travel photos/reels are the best-engaged organic content.
- Interest stack that worked: streetwear, baseball cap, hat, travel, adventure, frequent travellers.

MANAGED AD SETS, LAST 7 DAYS:
${perf || "(no data yet)"}

ALREADY TRIED — running/won: ${won.map((e) => e.name).join("; ") || "none"}
LOST (do not repeat): ${lost.map((e) => `${e.name} — ${e.resultNote ?? ""}`).join("; ") || "none"}

COPY RULES (absolute): ${config.copyRules}

Use web search to check current Indian D2C fashion-accessory audience/CPM benchmarks and any new Meta interest categories worth testing. Then call submit_experiments with 3 genuinely different, specific experiments (different audience angles — e.g. niche interests like specific travel/outdoor/streetwear communities, lookalike tiers, or warm-audience layers) restricted to men 18–44 unless retargeting, and 3–5 concrete suggestions: interest keywords to try, image/reel angles from real customers to shoot or reuse, and copy angles. Never propose discounts or COD.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 6000,
      messages: [{ role: "user", content: prompt }],
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }, IDEAS_TOOL],
      tool_choice: { type: "auto" },
    }),
  });
  if (!res.ok) throw new Error(`Claude API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const toolUse = (data.content ?? []).find((b: { type: string; name?: string }) => b.type === "tool_use" && b.name === "submit_experiments");
  if (!toolUse) throw new Error("Claude did not submit experiments");
  const out = toolUse.input as {
    experiments: {
      name: string;
      hypothesis: string;
      targetingKind: PmExperiment["targetingKind"];
      interestKeywords?: string[];
      audienceKeys?: string[];
      ageMin: number;
      ageMax: number;
      menOnly: boolean;
      creativeKind: "catalog";
      messages: string[];
    }[];
    suggestions: string[];
  };

  for (const e of out.experiments) {
    state.experiments.push({
      id: newId(),
      name: e.name,
      hypothesis: e.hypothesis,
      targetingKind: e.targetingKind,
      interestKeywords: e.interestKeywords,
      audienceKeys: e.audienceKeys,
      excludeAudienceKeys: e.targetingKind === "retargeting" ? ["purchasers180"] : ["pastAll", "purchasers180"],
      ageMin: Math.max(18, e.ageMin),
      ageMax: Math.min(e.targetingKind === "retargeting" ? 54 : 44, e.ageMax),
      genders: e.menOnly ? [1] : undefined,
      advantageAudience: e.targetingKind === "broad",
      creativeKind: "catalog",
      messages: e.messages,
      status: "planned",
      createdAt: nowIso(),
      source: "claude",
    });
  }
  for (const s of out.suggestions) state.suggestions.push({ at: nowIso(), text: s });
  state.lastIdeasDate = istDate();
  log(state, { entityType: "experiment", entityId: null, entityName: "ideas", action: "ideas_generated", reason: `${out.experiments.length} experiments queued: ${out.experiments.map((e) => e.name).join("; ")}` });
}

// ---------------- Daily report ----------------

async function sendDailyReport(state: PmState, config: Awaited<ReturnType<typeof getPmConfig>>, rows: AdSetInsightRow[], decisions: string[]) {
  const yesterday = istDate(-1);
  const managed = rows.filter((r) => config.managedCampaignIds.includes(r.campaignId));
  const others = rows.filter((r) => !config.managedCampaignIds.includes(r.campaignId));
  const fmt = (list: AdSetInsightRow[]) => {
    const g = byAdset(list);
    return [...g.values()]
      .map((x) => {
        const y = x.days.find((d) => d.date === yesterday);
        const w7 = sumWindow(x.days, 7);
        return `• ${x.campaignName} › ${x.name}: yesterday ₹${y?.spend ?? 0} → ${y?.purchases ?? 0} orders (${y?.roas ?? 0}x) | 7d ₹${w7.spend} → ${w7.purchases} orders (${w7.roas ? w7.roas.toFixed(2) : 0}x)`;
      })
      .join("\n");
  };
  const managedAll = byAdset(managed);
  const blended7 = sumWindow(
    [...managedAll.values()].flatMap((g) => g.days),
    999
  );
  const queued = state.experiments.filter((e) => e.status === "planned").slice(0, 3);
  const text = [
    `Travaholic Ads — ${yesterday}`,
    `Managed (target ${config.targetRoas}x, cap ₹${config.capRupees}/day): ${managed.length ? `${blended7.purchases} orders on ₹${blended7.spend} = ${blended7.roas ? blended7.roas.toFixed(2) : 0}x over the window` : "no managed spend yet"}`,
    fmt(managed) || "• (no managed ad sets ran)",
    others.length ? `\nOther campaigns (not managed):\n${fmt(others)}` : "",
    decisions.length ? `\nActions today:\n${decisions.map((d) => `• ${d}`).join("\n")}` : "\nActions today: none",
    queued.length ? `\nNext up:\n${queued.map((e) => `• ${e.name}`).join("\n")}` : "",
    state.suggestions.length ? `\nSuggestions:\n${state.suggestions.slice(-3).map((s) => `• ${s.text}`).join("\n")}` : "",
    state.halted ? "\n⚠️ Managed campaign is HALTED (blended ROAS under target 3 days). Relaunches with the next experiment on the next sweep." : "",
  ]
    .filter(Boolean)
    .join("\n");

  const html = `<pre style="font-family:ui-monospace,Menlo,monospace;font-size:13px;white-space:pre-wrap">${text.replace(/</g, "&lt;")}</pre>`;
  for (const to of config.alertEmails) await sendEmail(to, `Ads daily report — ${yesterday}`, html);
  if (config.alertWhatsApp) {
    const r = await sendWhatsAppSessionMessage(config.alertWhatsApp, text.slice(0, 3900));
    if (!r.sent) log(state, { entityType: "system", entityId: null, entityName: "digest", action: "whatsapp_skipped", reason: r.error ?? "not sent" });
  }
}

/** Read-only account view for the admin page. */
export async function getPerformanceOverview() {
  const [config, state, campaigns] = await Promise.all([getPmConfig(), getPmState(), listCampaigns().catch(() => [])]);
  const active = campaigns.filter((c) => c.effectiveStatus === "ACTIVE");
  const sizes = Object.keys(config.audiences).length ? await getAudienceSizes(Object.values(config.audiences)).catch(() => ({})) : {};
  return { config, state, activeCampaigns: active, audienceSizes: sizes };
}

export { AUDIENCE_KEYS, getAdSetFlexibleSpec };
