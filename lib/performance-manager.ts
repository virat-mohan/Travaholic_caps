import { getSupabaseServerClient } from "@/lib/supabase";
import { getSetting, setSetting } from "@/lib/settings";
import { getBrandProfile } from "@/lib/brand";
import { sendEmail } from "@/lib/email";
import { renderAdsReportHtml, type AdsReport, type ReportAdSet, type ReportAction } from "@/lib/ads-report-email";
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
  setAdSetDailySpendCapRupees,
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
  searchCityKey,
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
// Alert-only: N consecutive complete days under target is worth telling the
// owner about, but at ₹250/day per ad set a day with zero orders is ordinary
// variance, so it never pauses anything on its own.
const ALERT_CONSECUTIVE_DAYS = 3;
const MIN_DAILY_SPEND_TO_JUDGE = 100;
// Verdicts are spend-based: an ad set is only judged once it has spent
// enough for ~6 expected orders at target (≈ ₹2,000 at ₹1,399 AOV / 4x).
const MIN_SPEND_FOR_VERDICT = 2000;
const KILL_ROAS_7D = 2; // below this over 7d (≥ MIN_SPEND) → pause and replace
const THROTTLE_ROAS_7D = 3; // 2–3x → cut its CBO share 30% and flag a creative swap
const THROTTLE_FACTOR = 0.7;
const SCALE_ROAS_7D_FACTOR = 1.25; // ≥ 1.25× target (5x at a 4x target) → +20%
const SCALE_MIN_PURCHASES_7D = 6;
const SCALE_MULTIPLIER = 1.2;
const BUDGET_CHANGE_COOLDOWN_MS = 72 * 3600 * 1000; // >20% edits reset Meta's learning phase
const HALT_MIN_SPEND_7D = 3000;
const FATIGUE_FREQUENCY = 3;
const FATIGUE_CTR_DROP = 0.3; // last-3-day CTR down 30% vs the ad set's first week
const LAUNCH_COOLDOWN_MS = 7 * 86400000; // at most one new experiment a week at this budget
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
  /** Restrict delivery to these Indian cities (resolved to Meta geo keys at launch). */
  cityNames?: string[];
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
  source: "bootstrap" | "claude" | "manual" | "calendar";
  /** Daily spend cap set on the ad set (CBO "give it less" lever), if throttled. */
  spendCapRupees?: number;
  needsCreativeRefresh?: boolean;
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
  lastBudgetChangeAt?: string;
  lastLaunchAt?: string;
  /** Rolling alert flags surfaced in the report (not actions). */
  alerts?: string[];
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

  let cityKeys: string[] | undefined;
  if (exp.cityNames && exp.cityNames.length) {
    cityKeys = [];
    for (const name of exp.cityNames) {
      try {
        const hit = await searchCityKey(name);
        if (hit) cityKeys.push(hit.key);
      } catch {
        // skip unresolvable city
      }
    }
    if (cityKeys.length === 0) {
      exp.status = "blocked";
      exp.resultNote = "None of the city names resolved in Meta's geo search.";
      return false;
    }
  }

  const targeting: ManagedTargeting = {
    ageMin: exp.ageMin,
    ageMax: exp.ageMax,
    genders: exp.genders,
    flexibleSpec,
    cityKeys,
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

async function refillActiveSlots(state: PmState, campaignId: string, audiences: Record<string, string>, max = TARGET_ACTIVE_ADSETS, opts?: { ignoreCooldown?: boolean }) {
  let running = state.experiments.filter((e) => e.status === "running").length;
  // One new ad set a week at this budget — more and none of them ever
  // reaches the spend needed for a verdict. Bootstrap/relaunch bypass this.
  const cooldownActive = !opts?.ignoreCooldown && !!state.lastLaunchAt && Date.now() - new Date(state.lastLaunchAt).getTime() < LAUNCH_COOLDOWN_MS;
  for (const exp of state.experiments) {
    if (running >= max) break;
    if (cooldownActive) break;
    if (exp.status !== "planned" && exp.status !== "blocked") continue;
    try {
      if (await launchExperiment(state, exp, campaignId, audiences)) {
        running += 1;
        state.lastLaunchAt = nowIso();
        if (!opts?.ignoreCooldown) break;
      }
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
  await refillActiveSlots(state, campaignId, audiences, TARGET_ACTIVE_ADSETS, { ignoreCooldown: true });

  state.halted = false;
  await savePmState(state);
  return { campaignId, audiences, experiments: state.experiments, actions: state.actions.slice(-20) };
}

// ---------------- Daily sweep ----------------

type AdSetDay = { date: string; spend: number; purchases: number; purchaseValue: number; roas: number | null; impressions: number; linkClicks: number; frequency: number };

function byAdset(rows: AdSetInsightRow[]) {
  const map = new Map<string, { name: string; campaignId: string; campaignName: string; days: AdSetDay[] }>();
  for (const r of rows) {
    const e = map.get(r.adsetId) ?? { name: r.adsetName, campaignId: r.campaignId, campaignName: r.campaignName, days: [] };
    e.days.push({ date: r.date, spend: r.spend, purchases: r.purchases, purchaseValue: r.purchaseValue, roas: r.roas, impressions: r.impressions ?? 0, linkClicks: r.linkClicks ?? 0, frequency: r.frequency ?? 0 });
    map.set(r.adsetId, e);
  }
  for (const e of map.values()) e.days.sort((a, b) => (a.date < b.date ? 1 : -1));
  return map;
}

function ctrOf(days: AdSetDay[]) {
  const imp = days.reduce((s, d) => s + d.impressions, 0);
  const clicks = days.reduce((s, d) => s + d.linkClicks, 0);
  return imp > 0 ? clicks / imp : null;
}

/** Real revenue (our orders table, all channels) ÷ managed ad spend over the window — the number Meta's attribution can't undercount. */
async function computeMer(managedDays: AdSetDay[], windowDays: number) {
  const dates = [...new Set(managedDays.map((d) => d.date))].sort().slice(-windowDays);
  if (dates.length === 0) return { spend: 0, revenue: 0, orders: 0, mer: null as number | null, dates };
  const spend = managedDays.filter((d) => dates.includes(d.date)).reduce((s, d) => s + d.spend, 0);
  const supabase = getSupabaseServerClient();
  const since = new Date(`${dates[0]}T00:00:00+05:30`).toISOString();
  const until = new Date(new Date(`${dates[dates.length - 1]}T00:00:00+05:30`).getTime() + 86400000).toISOString();
  const { data } = await supabase.from("orders").select("total").gte("created_at", since).lt("created_at", until).neq("status", "cancelled");
  const revenue = (data ?? []).reduce((s, o) => s + (o.total ?? 0), 0);
  return { spend, revenue, orders: (data ?? []).length, mer: spend > 0 ? revenue / spend : null, dates };
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

    // 1. Ad-set verdict ladder — spend-based, rolling 7 days. Nothing is
    //    judged before it has spent MIN_SPEND_FOR_VERDICT; short streaks
    //    under target only raise an alert.
    state.alerts = [];
    for (const [adsetId, g] of groups) {
      const live = liveAdSets.find((a) => a.id === adsetId);
      if (!live || live.effectiveStatus !== "ACTIVE") continue;
      const exp = state.experiments.find((e) => e.adsetId === adsetId);
      const w7 = sumWindow(g.days, 7);
      const roas7 = w7.roas ?? 0;
      const below = consecutiveDaysBelow(g.days, config.targetRoas);
      if (below >= ALERT_CONSECUTIVE_DAYS) {
        state.alerts.push(`"${g.name}" is ${below} days under ${config.targetRoas}x (7d ₹${w7.spend} → ${roas7.toFixed(2)}x)${w7.spend < MIN_SPEND_FOR_VERDICT ? " — still under the ₹2,000 verdict threshold, watching" : ""}.`);
      }

      // Creative fatigue: high frequency or CTR down sharply vs the ad set's first week.
      const firstWeek = g.days.slice(-7);
      const last3 = g.days.slice(0, 3);
      const ctrBase = ctrOf(firstWeek);
      const ctrNow = ctrOf(last3);
      const freq7 = w7.spend > 0 ? Math.max(...g.days.slice(0, 7).map((d) => d.frequency)) : 0;
      const ctrDropped = ctrBase !== null && ctrNow !== null && g.days.length >= 10 && ctrNow < ctrBase * (1 - FATIGUE_CTR_DROP);
      if ((freq7 > FATIGUE_FREQUENCY || ctrDropped) && exp && !exp.needsCreativeRefresh) {
        exp.needsCreativeRefresh = true;
        const why = freq7 > FATIGUE_FREQUENCY ? `frequency ${freq7.toFixed(1)} (>${FATIGUE_FREQUENCY})` : `CTR ${((ctrNow ?? 0) * 100).toFixed(2)}% vs ${((ctrBase ?? 0) * 100).toFixed(2)}% in week one`;
        log(state, { entityType: "adset", entityId: adsetId, entityName: g.name, action: "creative_fatigue", reason: `${why} — swap the creative before touching the audience.` });
        state.suggestions.push({ at: nowIso(), text: `Creative refresh needed on "${g.name}": ${why}. Try a different real-customer photo/reel with the same audience.` });
        decisions.push(`Flagged creative fatigue on "${g.name}" (${why}).`);
      }

      if (w7.spend < MIN_SPEND_FOR_VERDICT) continue;

      if (roas7 < KILL_ROAS_7D) {
        const reason = `7-day ROAS ${roas7.toFixed(2)}x on ₹${w7.spend} (${w7.purchases} orders) — below the ${KILL_ROAS_7D}x kill line.`;
        await setAdSetStatus(adsetId, "PAUSED");
        if (exp) {
          exp.status = "lost";
          exp.endedAt = nowIso();
          exp.resultNote = reason;
        }
        log(state, { entityType: "adset", entityId: adsetId, entityName: g.name, action: "paused", reason, before: "ACTIVE", after: "PAUSED" });
        decisions.push(`Paused "${g.name}": ${reason}`);
      } else if (roas7 < THROTTLE_ROAS_7D) {
        const avgDaily = Math.max(50, Math.round(w7.spend / Math.min(7, g.days.length)));
        const cap = Math.round(avgDaily * THROTTLE_FACTOR);
        if (!exp?.spendCapRupees || exp.spendCapRupees > cap) {
          await setAdSetDailySpendCapRupees(adsetId, cap);
          if (exp) exp.spendCapRupees = cap;
          const reason = `7-day ROAS ${roas7.toFixed(2)}x (₹${w7.spend}, ${w7.purchases} orders) — between ${KILL_ROAS_7D}x and ${THROTTLE_ROAS_7D}x, so its daily share is capped at ₹${cap} and a creative swap is queued instead of killing the audience.`;
          if (exp) exp.needsCreativeRefresh = true;
          log(state, { entityType: "adset", entityId: adsetId, entityName: g.name, action: "throttled", reason, before: `₹${avgDaily}/day avg`, after: `cap ₹${cap}/day` });
          decisions.push(`Throttled "${g.name}" to ₹${cap}/day: ${reason}`);
        }
      } else if (exp?.spendCapRupees && roas7 >= config.targetRoas) {
        // Recovered — release the throttle so CBO can feed it again.
        await setAdSetDailySpendCapRupees(adsetId, null);
        exp.spendCapRupees = undefined;
        log(state, { entityType: "adset", entityId: adsetId, entityName: g.name, action: "throttle_released", reason: `Back to ${roas7.toFixed(2)}x over 7 days.` });
        decisions.push(`Released throttle on "${g.name}" (${roas7.toFixed(2)}x).`);
      }
    }

    // 2. Campaign-level blended guard + scale
    const managedDays = new Map<string, AdSetDay>();
    for (const g of groups.values()) {
      for (const d of g.days) {
        const m = managedDays.get(d.date) ?? { date: d.date, spend: 0, purchases: 0, purchaseValue: 0, roas: null, impressions: 0, linkClicks: 0, frequency: 0 };
        m.spend += d.spend;
        m.purchases += d.purchases;
        m.purchaseValue += d.purchaseValue;
        m.impressions += d.impressions;
        m.linkClicks += d.linkClicks;
        m.roas = m.spend > 0 ? Number((m.purchaseValue / m.spend).toFixed(2)) : null;
        managedDays.set(d.date, m);
      }
    }
    const blendedDays = [...managedDays.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
    const blendedBelow = consecutiveDaysBelow(blendedDays, config.targetRoas);
    const w7 = sumWindow(blendedDays, 7);
    const mer7 = await computeMer(blendedDays, 7);
    const currentBudget = (await getCampaignDailyBudgetRupees(campaignId)) ?? config.capRupees;
    const budgetCooldownOver = !state.lastBudgetChangeAt || Date.now() - new Date(state.lastBudgetChangeAt).getTime() > BUDGET_CHANGE_COOLDOWN_MS;

    if (currentBudget > config.capRupees) {
      await setCampaignDailyBudgetRupees(campaignId, config.capRupees);
      state.lastBudgetChangeAt = nowIso();
      log(state, { entityType: "campaign", entityId: campaignId, entityName: "PM Prospecting", action: "budget_capped", reason: "Budget was above the configured cap.", before: `₹${currentBudget}`, after: `₹${config.capRupees}` });
      decisions.push(`Budget pulled back to the ₹${config.capRupees}/day cap.`);
    }

    if (blendedBelow >= ALERT_CONSECUTIVE_DAYS) {
      state.alerts.push(`Blended managed ROAS has been under ${config.targetRoas}x for ${blendedBelow} consecutive days (7d Meta ${(w7.roas ?? 0).toFixed(2)}x, real MER ${mer7.mer ? mer7.mer.toFixed(2) : "0"}x on ₹${mer7.spend}).`);
    }

    // Halt on the number Meta can't undercount: real revenue ÷ managed spend
    // over 7 days, once there's enough spend for it to mean something.
    const merHalt = mer7.spend >= HALT_MIN_SPEND_7D && (mer7.mer ?? 0) < config.targetRoas && (w7.roas ?? 0) < config.targetRoas;
    if (merHalt && !state.halted) {
      await setCampaignStatus(campaignId, "PAUSED");
      state.halted = true;
      for (const e of state.experiments) {
        if (e.status === "running") {
          e.status = "paused";
          e.resultNote = "Campaign halted: 7-day MER and Meta ROAS both under target.";
        }
      }
      const reason = `7-day real MER ${(mer7.mer ?? 0).toFixed(2)}x (₹${mer7.revenue} revenue on ₹${mer7.spend} spend) and Meta ROAS ${(w7.roas ?? 0).toFixed(2)}x are both under ${config.targetRoas}x — campaign paused. Relaunches with the next queued experiment on the following sweep.`;
      log(state, { entityType: "campaign", entityId: campaignId, entityName: "PM Prospecting", action: "halted", reason, before: "ACTIVE", after: "PAUSED" });
      decisions.push(reason);
    } else if (state.halted) {
      await setCampaignStatus(campaignId, "ACTIVE");
      state.halted = false;
      state.lastLaunchAt = undefined; // a relaunch is allowed to bring in a fresh experiment immediately
      log(state, { entityType: "campaign", entityId: campaignId, entityName: "PM Prospecting", action: "resumed", reason: "Relaunching with the next queued experiments after a halt.", before: "PAUSED", after: "ACTIVE" });
      decisions.push("Campaign resumed with fresh experiments after halt.");
    } else if (
      w7.purchases >= SCALE_MIN_PURCHASES_7D &&
      (w7.roas ?? 0) >= config.targetRoas * SCALE_ROAS_7D_FACTOR &&
      (mer7.mer ?? 0) >= config.targetRoas &&
      currentBudget < config.capRupees
    ) {
      if (!budgetCooldownOver) {
        decisions.push(`Scale condition met (7d ${(w7.roas ?? 0).toFixed(2)}x, MER ${(mer7.mer ?? 0).toFixed(2)}x) but the last budget change was under 72h ago — holding to protect the learning phase.`);
      } else {
        const next = Math.min(Math.round(currentBudget * SCALE_MULTIPLIER), config.capRupees);
        await setCampaignDailyBudgetRupees(campaignId, next);
        state.lastBudgetChangeAt = nowIso();
        log(state, { entityType: "campaign", entityId: campaignId, entityName: "PM Prospecting", action: "budget_increased", reason: `7-day ROAS ${(w7.roas ?? 0).toFixed(2)}x on ${w7.purchases} purchases, MER ${(mer7.mer ?? 0).toFixed(2)}x.`, before: `₹${currentBudget}`, after: `₹${next}` });
        decisions.push(`Budget scaled ₹${currentBudget} → ₹${next} (7-day ROAS ${(w7.roas ?? 0).toFixed(2)}x, MER ${(mer7.mer ?? 0).toFixed(2)}x).`);
      }
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
      await refillActiveSlots(state, campaignId, audiences, TARGET_ACTIVE_ADSETS, { ignoreCooldown: decisions.some((d) => d.startsWith("Campaign resumed")) });
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
  const managedDayList = [...managedAll.values()].flatMap((g) => g.days);
  const mer7 = await computeMer(managedDayList, 7);
  const cpa7 = blended7.purchases > 0 ? Math.round(blended7.spend / blended7.purchases) : null;
  const isMonday = new Date().toLocaleDateString("en-US", { timeZone: "Asia/Kolkata", weekday: "short" }) === "Mon";

  const weekly = isMonday
    ? [
        "\n📅 WEEKLY REVIEW (last 7 days)",
        `• Real MER: ${mer7.mer ? mer7.mer.toFixed(2) : "0"}x — ₹${mer7.revenue} site revenue (${mer7.orders} orders, all channels) on ₹${mer7.spend} ad spend`,
        `• Meta ROAS: ${blended7.roas ? blended7.roas.toFixed(2) : 0}x · CPA ₹${cpa7 ?? "—"} (needs ≤ ₹${Math.round(1399 / config.targetRoas)} for ${config.targetRoas}x)`,
        `• Experiments: ${state.experiments.filter((e) => e.status === "running").length} running, ${state.experiments.filter((e) => e.status === "lost").length} lost, ${state.experiments.filter((e) => e.status === "planned").length} queued`,
        state.experiments.some((e) => e.needsCreativeRefresh && e.status === "running") ? `• Needs new creative: ${state.experiments.filter((e) => e.needsCreativeRefresh && e.status === "running").map((e) => e.name).join("; ")}` : "",
        "• Your call this week: approve a creative angle, push the Buy-3 bundle, or give a borderline experiment one more week.",
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const text = [
    `Travaholic Ads — ${yesterday}`,
    `Managed (target ${config.targetRoas}x, cap ₹${config.capRupees}/day): ${managed.length ? `${blended7.purchases} orders on ₹${blended7.spend} = ${blended7.roas ? blended7.roas.toFixed(2) : 0}x Meta · real MER ${mer7.mer ? mer7.mer.toFixed(2) : "0"}x · CPA ₹${cpa7 ?? "—"}` : "no managed spend yet"}`,
    fmt(managed) || "• (no managed ad sets ran)",
    others.length ? `\nOther campaigns (not managed):\n${fmt(others)}` : "",
    decisions.length ? `\nActions today:\n${decisions.map((d) => `• ${d}`).join("\n")}` : "\nActions today: none",
    state.alerts?.length ? `\n⚠️ Watch:\n${state.alerts.map((a) => `• ${a}`).join("\n")}` : "",
    queued.length ? `\nNext up:\n${queued.map((e) => `• ${e.name}`).join("\n")}` : "",
    state.suggestions.length ? `\nSuggestions:\n${state.suggestions.slice(-3).map((s) => `• ${s.text}`).join("\n")}` : "",
    weekly,
    state.halted ? "\n🛑 Managed campaign is HALTED (7-day MER and Meta ROAS both under target). Relaunches with the next experiment on the next sweep." : "",
  ]
    .filter(Boolean)
    .join("\n");

  const html = renderAdsReportHtml(
    buildAdsReport({ state, config, yesterday, managed, others, blended7, mer7, cpa7, decisions, queued, isMonday })
  );
  for (const to of config.alertEmails) await sendEmail(to, `${isMonday ? "Weekly ads review" : "Ads daily report"} — ${yesterday}`, html);
  if (config.alertWhatsApp) {
    const r = await sendWhatsAppSessionMessage(config.alertWhatsApp, text.slice(0, 3900));
    if (!r.sent) log(state, { entityType: "system", entityId: null, entityName: "digest", action: "whatsapp_skipped", reason: r.error ?? "not sent" });
  }
}

function addDaysIso(fromIso: string, days: number) {
  return new Date(new Date(`${fromIso}T12:00:00+05:30`).getTime() + days * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}
function whenLabel(isoDate: string) {
  const today = istDate();
  if (isoDate <= today) return "Today";
  if (isoDate === addDaysIso(today, 1)) return "Tomorrow";
  return new Date(`${isoDate}T12:00:00+05:30`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

function buildAdsReport(p: {
  state: PmState;
  config: Awaited<ReturnType<typeof getPmConfig>>;
  yesterday: string;
  managed: AdSetInsightRow[];
  others: AdSetInsightRow[];
  blended7: ReturnType<typeof sumWindow>;
  mer7: Awaited<ReturnType<typeof computeMer>>;
  cpa7: number | null;
  decisions: string[];
  queued: PmExperiment[];
  isMonday: boolean;
}): AdsReport {
  const { state, config, yesterday, managed, others, blended7, mer7, cpa7, decisions, queued, isMonday } = p;
  const today = istDate();
  const targetCpa = Math.round(1399 / config.targetRoas);
  const weekStart = addDaysIso(yesterday, -6);

  const byId = new Map<string, AdSetInsightRow[]>();
  for (const r of managed) if (r.date >= weekStart) byId.set(r.adsetId, [...(byId.get(r.adsetId) ?? []), r]);
  const adSets: ReportAdSet[] = [...byId.values()].map((rs) => {
    const y = rs.find((r) => r.date === yesterday);
    const spend = rs.reduce((s, r) => s + r.spend, 0);
    const value = rs.reduce((s, r) => s + r.purchaseValue, 0);
    return {
      name: rs[0].adsetName.replace(/^PM \| /, ""),
      yesterday: { spend: y?.spend ?? 0, purchases: y?.purchases ?? 0, roas: y?.roas ?? null },
      week: {
        spend,
        value,
        purchases: rs.reduce((s, r) => s + r.purchases, 0),
        clicks: rs.reduce((s, r) => s + r.linkClicks, 0),
        addToCarts: rs.reduce((s, r) => s + r.addToCarts, 0),
        roas: spend > 0 ? value / spend : null,
        activeDays: new Set(rs.filter((r) => r.spend > 0).map((r) => r.date)).size,
      },
    };
  });

  // ---- Insights: plain-language reads of this week's numbers ----
  const insights: string[] = [];
  const clicks = adSets.reduce((s, a) => s + a.week.clicks, 0);
  const carts = adSets.reduce((s, a) => s + a.week.addToCarts, 0);
  const orders = adSets.reduce((s, a) => s + a.week.purchases, 0);
  const spend = adSets.reduce((s, a) => s + a.week.spend, 0);
  if (clicks > 0) {
    if (carts > 0 && orders === 0) insights.push(`${clicks} clicks turned into ${carts} add-to-carts but no orders. Interest is there, so if carts keep not converting, the drop-off is at checkout, not in the ads.`);
    else if (carts === 0) insights.push(`${clicks} clicks and no add-to-carts yet. People are visiting but not engaging with a product, which is usually a creative/landing mismatch.`);
    else insights.push(`Funnel: ${clicks} clicks → ${carts} add-to-carts → ${orders} orders (${((orders / clicks) * 100).toFixed(1)}% click-to-order).`);
  }
  const withSpend = adSets.filter((a) => a.week.spend >= 50 && a.week.clicks > 0);
  if (withSpend.length > 1) {
    const cpc = (a: ReportAdSet) => a.week.spend / a.week.clicks;
    const best = [...withSpend].sort((a, b) => cpc(a) - cpc(b))[0];
    const worst = [...withSpend].sort((a, b) => cpc(b) - cpc(a))[0];
    insights.push(`Cheapest traffic: ${best.name} at ${"₹" + cpc(best).toFixed(1)} per click. Most expensive: ${worst.name} at ${"₹" + cpc(worst).toFixed(1)}.`);
    const bestCart = [...withSpend].sort((a, b) => b.week.addToCarts / b.week.clicks - a.week.addToCarts / a.week.clicks)[0];
    if (bestCart.week.addToCarts > 0) insights.push(`Highest purchase intent: ${bestCart.name}, with ${bestCart.week.addToCarts} add-to-carts from ${bestCart.week.clicks} clicks.`);
  }
  if (spend > 0 && spend < 2000 * Math.max(1, adSets.length)) insights.push(`Each ad set needs about ₹2,000 of spend before a fair verdict. We're at ${"₹" + Math.round(spend).toLocaleString("en-IN")} across ${adSets.length}, so the numbers are still early signals.`);
  if (cpa7 !== null) insights.push(cpa7 <= targetCpa ? `Cost per order ${"₹" + cpa7} is within the ${"₹" + targetCpa} needed for ${config.targetRoas}x.` : `Cost per order ${"₹" + cpa7} is above the ${"₹" + targetCpa} needed for ${config.targetRoas}x.`);
  for (const a of state.alerts ?? []) insights.push(a);

  // ---- Actions: what's scheduled, and when ----
  const upcoming: ReportAction[] = [];
  for (const a of adSets) {
    if (a.week.spend >= 2000) continue;
    // Average over days it actually ran, not a fixed 7 — a 2-day-old ad set
    // averaged over 7 days pushes the estimate months out.
    const perDay = a.week.spend / Math.max(1, a.week.activeDays) || 1;
    const days = Math.max(1, Math.ceil((2000 - a.week.spend) / perDay));
    upcoming.push({ when: whenLabel(addDaysIso(today, days)), what: `First verdict on ${a.name} once it reaches ₹2,000 spend: scale, hold, throttle or pause.`, owner: "System" });
  }
  if (state.lastBudgetChangeAt) {
    const until = new Date(new Date(state.lastBudgetChangeAt).getTime() + 72 * 3600 * 1000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    if (until > today) upcoming.push({ when: whenLabel(until), what: "Budget can move again. It's held for 72 hours after each change so Meta's learning isn't reset.", owner: "System" });
  }
  if (queued[0]) {
    const next = state.lastLaunchAt ? addDaysIso(new Date(state.lastLaunchAt).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }), 7) : today;
    upcoming.push({ when: whenLabel(next > today ? next : addDaysIso(today, 1)), what: `Next test launches: ${queued[0].name}.`, owner: "System" });
  }
  if (state.experiments.some((e) => e.targetingKind === "lookalike" && e.status === "blocked")) {
    upcoming.push({ when: "Today", what: "Accept Meta's Custom Audience terms (one click in Ads Manager) to unlock the past-customer lookalike, the strongest audience on the account.", owner: "You" });
  }
  for (const e of state.experiments.filter((e) => e.needsCreativeRefresh && e.status === "running")) {
    upcoming.push({ when: "This week", what: `Pick a new real-customer photo or reel for ${e.name}; the current creative is wearing out.`, owner: "You" });
  }
  const daysToMonday = (8 - new Date(`${today}T12:00:00+05:30`).getDay()) % 7 || 7;
  upcoming.push({ when: whenLabel(addDaysIso(today, daysToMonday)), what: "Weekly review: 7-day ROAS and MER, what won, what was paused, and the next test.", owner: "System" });
  upcoming.push({ when: "Tomorrow", what: "Next daily report, 8am.", owner: "System" });

  const othersById = new Map<string, AdSetInsightRow[]>();
  for (const r of others) if (r.date >= weekStart) othersById.set(r.campaignId, [...(othersById.get(r.campaignId) ?? []), r]);
  const otherCampaigns = [...othersById.values()]
    .map((rs) => {
      const s = rs.reduce((t, r) => t + r.spend, 0);
      const v = rs.reduce((t, r) => t + r.purchaseValue, 0);
      return { name: rs[0].campaignName, spend7: s, purchases7: rs.reduce((t, r) => t + r.purchases, 0), roas7: s > 0 ? v / s : null };
    })
    .filter((o) => o.spend7 > 0);

  return {
    date: yesterday,
    isWeekly: isMonday,
    targetRoas: config.targetRoas,
    capRupees: config.capRupees,
    halted: state.halted,
    adSets,
    totals: {
      spend: blended7.spend,
      purchases: blended7.purchases,
      value: blended7.value,
      roas: blended7.roas,
      mer: mer7.mer,
      siteRevenue: mer7.revenue,
      siteOrders: mer7.orders,
      cpa: cpa7,
      targetCpa,
    },
    insights: insights.slice(0, 6),
    doneToday: decisions,
    upcoming,
    otherCampaigns,
  };
}

/** Renders the current email report without sending it — for previewing the design. */
export async function previewAdsReportHtml() {
  const config = await getPmConfig();
  const state = await getPmState();
  const yesterday = istDate(-1);
  const rows = await getAdSetInsightsDaily(istDate(-8), yesterday);
  const managed = rows.filter((r) => config.managedCampaignIds.includes(r.campaignId));
  const others = rows.filter((r) => !config.managedCampaignIds.includes(r.campaignId));
  const managedDays = [...byAdset(managed).values()].flatMap((g) => g.days);
  const blended7 = sumWindow(managedDays, 999);
  const mer7 = await computeMer(managedDays, 7);
  const cpa7 = blended7.purchases > 0 ? Math.round(blended7.spend / blended7.purchases) : null;
  const queued = state.experiments.filter((e) => e.status === "planned").slice(0, 3);
  const isMonday = new Date().toLocaleDateString("en-US", { timeZone: "Asia/Kolkata", weekday: "short" }) === "Mon";
  return renderAdsReportHtml(buildAdsReport({ state, config, yesterday, managed, others, blended7, mer7, cpa7, decisions: [], queued, isMonday }));
}

/**
 * A content-calendar "launch" runs inside the managed campaign instead of
 * as its own campaign: it promotes the brief's matching Instagram post
 * (same chapter, or same headline for brand posts) so the post's likes and
 * comments travel with the ad, targeting the ICP (men 18–44, travel +
 * streetwear interests, past buyers excluded). Launched on the calendar
 * date itself — calendar launches are the owner's plan, so they bypass the
 * one-new-test-a-week cooldown and the 3-slot cap; the normal verdict
 * ladder still judges them like any other ad set. Falls back to a catalog
 * ad with the brief's copy when no matching post has been published yet.
 */
export async function launchCalendarBriefInManagedCampaign(briefId: string) {
  const supabase = getSupabaseServerClient();
  const config = await getPmConfig();
  const campaignId = config.managedCampaignIds[0];
  if (!campaignId) throw new Error("No managed campaign — run Bootstrap on /admin/performance first");

  const { data: brief } = await supabase
    .from("ad_briefs")
    .select("id, headline, primary_text, chapter_slug, chapter_slugs")
    .eq("id", briefId)
    .maybeSingle();
  if (!brief) throw new Error("Brief not found");

  const chapter = brief.chapter_slug ?? brief.chapter_slugs?.[0] ?? null;
  let postQuery = supabase
    .from("ad_briefs")
    .select("instagram_post_id, headline, posted_at")
    .not("instagram_post_id", "is", null)
    .order("posted_at", { ascending: false })
    .limit(1);
  postQuery = chapter ? postQuery.eq("chapter_slug", chapter) : postQuery.eq("headline", brief.headline);
  const { data: post } = await postQuery.maybeSingle();

  const state = await getPmState();
  const audiences = await ensureAudiences(state);
  const exp: PmExperiment = {
    id: newId(),
    name: `Calendar | ${brief.headline} | Men 18-44`,
    hypothesis: post
      ? `Calendar launch: promotes the "${post.headline}" Instagram post so its engagement carries into the ad.`
      : `Calendar launch: catalog ad with the scheduled copy (no matching Instagram post was live yet).`,
    targetingKind: "interests",
    interestKeywords: ["Streetwear", "Baseball cap", "Travel", "Adventure travel"],
    excludeAudienceKeys: ["pastAll", "purchasers180"],
    ageMin: 18,
    ageMax: 44,
    genders: [1],
    creativeKind: post ? "ig_post" : "catalog",
    igMediaId: post?.instagram_post_id ?? undefined,
    messages: [brief.primary_text, "Free shipping on every prepaid order. Buy 3, get 1 free — applied automatically at checkout."],
    status: "planned",
    createdAt: nowIso(),
    source: "calendar",
  };
  state.experiments.unshift(exp);
  const ok = await launchExperiment(state, exp, campaignId, audiences);
  if (!ok) {
    await savePmState(state);
    throw new Error(exp.resultNote ?? "Calendar launch could not start");
  }
  await savePmState(state);
  await supabase
    .from("ad_briefs")
    .update({ status: "launched", queue_status: "published", launched_at: nowIso(), meta_campaign_id: campaignId, meta_adset_id: exp.adsetId ?? null, meta_ad_id: exp.adIds?.[0] ?? null })
    .eq("id", briefId);
  return { adsetId: exp.adsetId, creative: exp.creativeKind };
}

/** Read-only account view for the admin page. */
export async function getPerformanceOverview() {
  const [config, state, campaigns] = await Promise.all([getPmConfig(), getPmState(), listCampaigns().catch(() => [])]);
  const active = campaigns.filter((c) => c.effectiveStatus === "ACTIVE");
  const sizes = Object.keys(config.audiences).length ? await getAudienceSizes(Object.values(config.audiences)).catch(() => ({})) : {};
  return { config, state, activeCampaigns: active, audienceSizes: sizes };
}

export { AUDIENCE_KEYS, getAdSetFlexibleSpec };
