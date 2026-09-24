import { createHash } from "crypto";
import { getSetting } from "@/lib/settings";

// Lower-level Meta Marketing API layer for the performance manager
// (lib/performance-manager.ts). lib/meta-ads.ts is the older brief-launch
// path (single ad, always PAUSED); this file covers what a real media buyer
// touches day to day: audiences, CBO sales campaigns, catalog/existing-post
// ads, and ad-set-level purchase insights.

const GRAPH_VERSION = "v21.0";

export async function getMetaMarketingAuth() {
  const [accessToken, adAccountId, pageId, pixelId, igUserId] = await Promise.all([
    getSetting("META_ACCESS_TOKEN"),
    getSetting("META_AD_ACCOUNT_ID"),
    getSetting("META_PAGE_ID"),
    getSetting("META_PIXEL_ID"),
    getSetting("INSTAGRAM_BUSINESS_ACCOUNT_ID"),
  ]);
  if (!accessToken || !adAccountId || !pageId) {
    throw new Error("Meta is not fully configured — add META_ACCESS_TOKEN, META_AD_ACCOUNT_ID and META_PAGE_ID in /admin/settings");
  }
  return {
    accessToken,
    account: `act_${adAccountId.replace(/^act_/, "")}`,
    pageId,
    pixelId: pixelId ?? null,
    igUserId: igUserId ?? null,
  };
}

export async function graphGet<T = Record<string, unknown>>(
  path: string,
  accessToken: string,
  params: Record<string, string> = {}
): Promise<T> {
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${path}?` + new URLSearchParams({ ...params, access_token: accessToken })
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Meta Graph API error (${path}): ${JSON.stringify(data).slice(0, 500)}`);
  return data as T;
}

export async function graphPost<T = Record<string, unknown>>(
  path: string,
  accessToken: string,
  body: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, access_token: accessToken }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Meta Graph API error (${path}): ${JSON.stringify(data).slice(0, 500)}`);
  return data as T;
}

// ---------------- Insights ----------------

export type AdSetInsightRow = {
  date: string;
  campaignId: string;
  campaignName: string;
  adsetId: string;
  adsetName: string;
  spend: number;
  impressions: number;
  linkClicks: number;
  purchases: number;
  purchaseValue: number;
  addToCarts: number;
  roas: number | null;
};

type RawInsight = {
  date_start: string;
  campaign_id: string;
  campaign_name: string;
  adset_id: string;
  adset_name: string;
  spend?: string;
  impressions?: string;
  inline_link_clicks?: string;
  actions?: { action_type: string; value: string }[];
  action_values?: { action_type: string; value: string }[];
};

function actionValue(row: RawInsight, type: string) {
  const a = (row.actions ?? []).find((x) => x.action_type === type);
  return a ? Number(a.value) : 0;
}
function actionMoney(row: RawInsight, type: string) {
  const a = (row.action_values ?? []).find((x) => x.action_type === type);
  return a ? Number(a.value) : 0;
}

function toRow(r: RawInsight): AdSetInsightRow {
  const spend = Number(r.spend ?? 0);
  const purchases = actionValue(r, "purchase") || actionValue(r, "omni_purchase");
  const purchaseValue = actionMoney(r, "purchase") || actionMoney(r, "omni_purchase");
  return {
    date: r.date_start,
    campaignId: r.campaign_id,
    campaignName: r.campaign_name,
    adsetId: r.adset_id,
    adsetName: r.adset_name,
    spend: Math.round(spend),
    impressions: Number(r.impressions ?? 0),
    linkClicks: Number(r.inline_link_clicks ?? 0),
    purchases,
    purchaseValue: Math.round(purchaseValue),
    addToCarts: actionValue(r, "add_to_cart"),
    roas: spend > 0 ? Number((purchaseValue / spend).toFixed(2)) : null,
  };
}

/** One row per ad set per day (Meta-attributed purchases, account timezone days) for the whole account. */
export async function getAdSetInsightsDaily(since: string, until: string): Promise<AdSetInsightRow[]> {
  const auth = await getMetaMarketingAuth();
  const rows: AdSetInsightRow[] = [];
  let url: string | null =
    `https://graph.facebook.com/${GRAPH_VERSION}/${auth.account}/insights?` +
    new URLSearchParams({
      level: "adset",
      fields: "campaign_id,campaign_name,adset_id,adset_name,spend,impressions,inline_link_clicks,actions,action_values",
      time_range: JSON.stringify({ since, until }),
      time_increment: "1",
      limit: "500",
      access_token: auth.accessToken,
    });
  while (url) {
    const res: Response = await fetch(url);
    const data: { data?: RawInsight[]; paging?: { next?: string } } = await res.json();
    if (!res.ok) throw new Error(`Meta insights error: ${JSON.stringify(data).slice(0, 400)}`);
    for (const r of data.data ?? []) rows.push(toRow(r));
    url = data.paging?.next ?? null;
  }
  return rows;
}

export type CampaignSummary = {
  id: string;
  name: string;
  status: string;
  effectiveStatus: string;
  dailyBudgetRupees: number | null;
  objective: string;
};

export async function listCampaigns(): Promise<CampaignSummary[]> {
  const auth = await getMetaMarketingAuth();
  const data = await graphGet<{ data: Record<string, string>[] }>(`${auth.account}/campaigns`, auth.accessToken, {
    fields: "id,name,status,effective_status,daily_budget,objective",
    limit: "200",
  });
  return (data.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    effectiveStatus: c.effective_status,
    dailyBudgetRupees: c.daily_budget ? Math.round(Number(c.daily_budget) / 100) : null,
    objective: c.objective,
  }));
}

export type AdSetSummary = { id: string; name: string; campaignId: string; effectiveStatus: string; dailyBudgetRupees: number | null };

export async function listAdSets(campaignIds: string[]): Promise<AdSetSummary[]> {
  if (campaignIds.length === 0) return [];
  const auth = await getMetaMarketingAuth();
  const data = await graphGet<{ data: Record<string, string>[] }>(`${auth.account}/adsets`, auth.accessToken, {
    fields: "id,name,campaign_id,effective_status,daily_budget",
    filtering: JSON.stringify([{ field: "campaign.id", operator: "IN", value: campaignIds }]),
    limit: "200",
  });
  return (data.data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    campaignId: a.campaign_id,
    effectiveStatus: a.effective_status,
    dailyBudgetRupees: a.daily_budget ? Math.round(Number(a.daily_budget) / 100) : null,
  }));
}

export async function setAdSetStatus(adsetId: string, status: "ACTIVE" | "PAUSED") {
  const auth = await getMetaMarketingAuth();
  await graphPost(adsetId, auth.accessToken, { status });
}

export async function setCampaignStatus(campaignId: string, status: "ACTIVE" | "PAUSED") {
  const auth = await getMetaMarketingAuth();
  await graphPost(campaignId, auth.accessToken, { status });
}

export async function setCampaignDailyBudgetRupees(campaignId: string, rupees: number) {
  const auth = await getMetaMarketingAuth();
  await graphPost(campaignId, auth.accessToken, { daily_budget: Math.round(rupees * 100) });
}

export async function getCampaignDailyBudgetRupees(campaignId: string): Promise<number | null> {
  const auth = await getMetaMarketingAuth();
  const data = await graphGet<{ daily_budget?: string }>(campaignId, auth.accessToken, { fields: "daily_budget" });
  return data.daily_budget ? Math.round(Number(data.daily_budget) / 100) : null;
}

// ---------------- Audiences ----------------

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/** Normalises to Meta's customer-file spec: lowercase trimmed email, digits-only phone with country code, lowercase name/city/state. */
export function normalizeCustomerRecord(rec: {
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}) {
  const email = rec.email?.trim().toLowerCase() || null;
  let phone = rec.phone?.replace(/\D/g, "") || null;
  if (phone && phone.length === 10) phone = `91${phone}`;
  if (phone && phone.length === 11 && phone.startsWith("0")) phone = `91${phone.slice(1)}`;
  return {
    email,
    phone,
    firstName: rec.firstName?.trim().split(/\s+/)[0]?.toLowerCase() || null,
    city: rec.city?.trim().toLowerCase().replace(/[^a-z]/g, "") || null,
    state: rec.state?.trim().toLowerCase().replace(/[^a-z]/g, "") || null,
    zip: rec.zip?.trim() || null,
  };
}

/**
 * Creates a Customer List custom audience and uploads hashed records in
 * batches. Meta matches on any of the schema keys; sending several per
 * person materially raises the match rate over email-only. Returns the
 * audience id — the audience takes Meta ~1 hour to populate.
 */
export async function createCustomerListAudience(
  name: string,
  description: string,
  records: ReturnType<typeof normalizeCustomerRecord>[]
): Promise<string> {
  const auth = await getMetaMarketingAuth();
  const audience = await graphPost<{ id: string }>(`${auth.account}/customaudiences`, auth.accessToken, {
    name,
    description,
    subtype: "CUSTOM",
    customer_file_source: "USER_PROVIDED_ONLY",
  });

  const schema = ["EMAIL", "PHONE", "FN", "CT", "ST", "ZIP", "COUNTRY"];
  const data = records
    .filter((r) => r.email || r.phone)
    .map((r) => [
      r.email ? sha256(r.email) : "",
      r.phone ? sha256(r.phone) : "",
      r.firstName ? sha256(r.firstName) : "",
      r.city ? sha256(r.city) : "",
      r.state ? sha256(r.state) : "",
      r.zip ? sha256(r.zip) : "",
      sha256("in"),
    ]);

  const BATCH = 5000;
  for (let i = 0; i < data.length; i += BATCH) {
    await graphPost(`${audience.id}/users`, auth.accessToken, {
      payload: { schema, data: data.slice(i, i + BATCH) },
    });
  }
  return audience.id;
}

/** Pixel-based website audience — rule is Meta's standard event/url JSON. */
export async function createWebsiteAudience(name: string, pixelId: string, retentionDays: number, eventName: string | null): Promise<string> {
  const auth = await getMetaMarketingAuth();
  const rule = eventName
    ? {
        inclusions: {
          operator: "or",
          rules: [
            {
              event_sources: [{ id: pixelId, type: "pixel" }],
              retention_seconds: retentionDays * 86400,
              filter: { operator: "and", filters: [{ field: "event", operator: "eq", value: eventName }] },
            },
          ],
        },
      }
    : {
        inclusions: {
          operator: "or",
          rules: [
            {
              event_sources: [{ id: pixelId, type: "pixel" }],
              retention_seconds: retentionDays * 86400,
              filter: { operator: "and", filters: [{ field: "url", operator: "i_contains", value: "" }] },
            },
          ],
        },
      };
  // v21+ rejects an explicit subtype for rule-based audiences — the rule itself implies WEBSITE.
  const audience = await graphPost<{ id: string }>(`${auth.account}/customaudiences`, auth.accessToken, {
    name,
    rule: JSON.stringify(rule),
    prefill: true,
  });
  return audience.id;
}

/** Everyone who engaged with the Instagram Business account in the last N days. */
export async function createInstagramEngagersAudience(name: string, igUserId: string, retentionDays: number): Promise<string> {
  const auth = await getMetaMarketingAuth();
  const rule = {
    inclusions: {
      operator: "or",
      rules: [
        {
          event_sources: [{ id: igUserId, type: "ig_business" }],
          retention_seconds: retentionDays * 86400,
          filter: { operator: "and", filters: [{ field: "event", operator: "eq", value: "ig_business_profile_all" }] },
        },
      ],
    },
  };
  const audience = await graphPost<{ id: string }>(`${auth.account}/customaudiences`, auth.accessToken, {
    name,
    rule: JSON.stringify(rule),
    prefill: true,
  });
  return audience.id;
}

export async function createLookalikeAudience(name: string, originAudienceId: string, ratio: number): Promise<string> {
  const auth = await getMetaMarketingAuth();
  const audience = await graphPost<{ id: string }>(`${auth.account}/customaudiences`, auth.accessToken, {
    name,
    subtype: "LOOKALIKE",
    origin_audience_id: originAudienceId,
    lookalike_spec: JSON.stringify({ type: "similarity", ratio, country: "IN" }),
  });
  return audience.id;
}

export async function getAudienceSizes(ids: string[]) {
  const auth = await getMetaMarketingAuth();
  const out: Record<string, { name: string; lower: number; upper: number; status: number | null }> = {};
  for (const id of ids) {
    try {
      const d = await graphGet<Record<string, unknown>>(id, auth.accessToken, {
        fields: "name,approximate_count_lower_bound,approximate_count_upper_bound,delivery_status",
      });
      out[id] = {
        name: String(d.name ?? ""),
        lower: Number(d.approximate_count_lower_bound ?? -1),
        upper: Number(d.approximate_count_upper_bound ?? -1),
        status: (d.delivery_status as { code?: number } | undefined)?.code ?? null,
      };
    } catch {
      // best-effort
    }
  }
  return out;
}

// ---------------- Campaign / ad set / ad creation ----------------

export type ManagedTargeting = {
  ageMin: number;
  ageMax: number;
  genders?: (1 | 2)[];
  /** Meta flexible_spec entries, e.g. [{ interests: [{id,name}], behaviors: [...] }]. */
  flexibleSpec?: Record<string, { id: string; name?: string }[]>[];
  customAudienceIds?: string[];
  excludedCustomAudienceIds?: string[];
  /** Let Meta expand beyond the defined audience when it finds better buyers. */
  advantageAudience?: boolean;
};

export function buildManagedTargeting(t: ManagedTargeting) {
  return {
    geo_locations: { countries: ["IN"] },
    age_min: t.ageMin,
    // Meta rejects an Advantage+ audience ad set with an age ceiling below 65 —
    // with expansion on, the age range is only a suggestion, not a control.
    age_max: t.advantageAudience ? 65 : t.ageMax,
    ...(t.genders && t.genders.length ? { genders: t.genders } : {}),
    ...(t.flexibleSpec && t.flexibleSpec.length ? { flexible_spec: t.flexibleSpec } : {}),
    ...(t.customAudienceIds && t.customAudienceIds.length ? { custom_audiences: t.customAudienceIds.map((id) => ({ id })) } : {}),
    ...(t.excludedCustomAudienceIds && t.excludedCustomAudienceIds.length
      ? { excluded_custom_audiences: t.excludedCustomAudienceIds.map((id) => ({ id })) }
      : {}),
    targeting_automation: { advantage_audience: t.advantageAudience ? 1 : 0 },
  };
}

/** Sales campaign with campaign-level (CBO) daily budget — Meta shifts spend to whichever ad set is converting. */
export async function createSalesCampaignCBO(name: string, dailyBudgetRupees: number, status: "ACTIVE" | "PAUSED") {
  const auth = await getMetaMarketingAuth();
  const campaign = await graphPost<{ id: string }>(`${auth.account}/campaigns`, auth.accessToken, {
    name,
    objective: "OUTCOME_SALES",
    status,
    special_ad_categories: [],
    daily_budget: Math.round(dailyBudgetRupees * 100),
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
  });
  return campaign.id;
}

export async function createPurchaseAdSet(input: {
  campaignId: string;
  name: string;
  targeting: ManagedTargeting;
  status: "ACTIVE" | "PAUSED";
  /** Catalog ad sets need the product set on the ad set's promoted_object. */
  productSetId?: string;
}) {
  const auth = await getMetaMarketingAuth();
  if (!auth.pixelId) throw new Error("META_PIXEL_ID is required for purchase-optimised ad sets");
  const adset = await graphPost<{ id: string }>(`${auth.account}/adsets`, auth.accessToken, {
    name: input.name,
    campaign_id: input.campaignId,
    billing_event: "IMPRESSIONS",
    optimization_goal: "OFFSITE_CONVERSIONS",
    promoted_object: {
      pixel_id: auth.pixelId,
      custom_event_type: "PURCHASE",
      ...(input.productSetId ? { product_set_id: input.productSetId } : {}),
    },
    targeting: buildManagedTargeting(input.targeting),
    attribution_spec: [
      { event_type: "CLICK_THROUGH", window_days: 7 },
      { event_type: "VIEW_THROUGH", window_days: 1 },
    ],
    status: input.status,
  });
  return adset.id;
}

/** Dynamic catalog ad — one creative that renders every in-stock product from the product set. */
export async function createCatalogAd(input: {
  adsetId: string;
  name: string;
  productSetId: string;
  messages: string[];
  link: string;
  status: "ACTIVE" | "PAUSED";
}) {
  const auth = await getMetaMarketingAuth();
  const creative = await graphPost<{ id: string }>(`${auth.account}/adcreatives`, auth.accessToken, {
    name: `${input.name} — Creative`,
    product_set_id: input.productSetId,
    object_story_spec: {
      page_id: auth.pageId,
      ...(auth.igUserId ? { instagram_user_id: auth.igUserId } : {}),
      template_data: {
        link: input.link,
        message: input.messages[0],
        name: "{{product.name}}",
        description: "{{product.price}}",
        call_to_action: { type: "SHOP_NOW" },
        multi_share_end_card: false,
      },
    },
    ...(input.messages.length > 1
      ? { asset_feed_spec: { bodies: input.messages.map((text) => ({ text })), optimization_type: "DEGREES_OF_FREEDOM" } }
      : {}),
  });
  const ad = await graphPost<{ id: string }>(`${auth.account}/ads`, auth.accessToken, {
    name: input.name,
    adset_id: input.adsetId,
    creative: { creative_id: creative.id },
    status: input.status,
  });
  return { adId: ad.id, creativeId: creative.id };
}

/** Boosts an existing organic Instagram post/reel as a conversion ad with a Shop Now link — the social proof (likes/comments) stays attached. */
export async function createExistingInstagramPostAd(input: {
  adsetId: string;
  name: string;
  igMediaId: string;
  link: string;
  status: "ACTIVE" | "PAUSED";
}) {
  const auth = await getMetaMarketingAuth();
  if (!auth.igUserId) throw new Error("INSTAGRAM_BUSINESS_ACCOUNT_ID is not set");
  const creative = await graphPost<{ id: string }>(`${auth.account}/adcreatives`, auth.accessToken, {
    name: `${input.name} — Creative`,
    instagram_user_id: auth.igUserId,
    source_instagram_media_id: input.igMediaId,
    call_to_action: { type: "SHOP_NOW", value: { link: input.link } },
  });
  const ad = await graphPost<{ id: string }>(`${auth.account}/ads`, auth.accessToken, {
    name: input.name,
    adset_id: input.adsetId,
    creative: { creative_id: creative.id },
    status: input.status,
  });
  return { adId: ad.id, creativeId: creative.id };
}

/** Single-image link ad from a hosted image URL (real product/UGC photo). */
export async function createImageLinkAd(input: {
  adsetId: string;
  name: string;
  imageUrl: string;
  headline: string;
  message: string;
  link: string;
  status: "ACTIVE" | "PAUSED";
}) {
  const auth = await getMetaMarketingAuth();
  const upload = await graphPost<{ images: Record<string, { hash: string }> }>(`${auth.account}/adimages`, auth.accessToken, {
    url: input.imageUrl,
  });
  const hash = Object.values(upload.images ?? {})[0]?.hash;
  if (!hash) throw new Error("Meta did not return an image hash");
  const creative = await graphPost<{ id: string }>(`${auth.account}/adcreatives`, auth.accessToken, {
    name: `${input.name} — Creative`,
    object_story_spec: {
      page_id: auth.pageId,
      ...(auth.igUserId ? { instagram_user_id: auth.igUserId } : {}),
      link_data: {
        message: input.message,
        link: input.link,
        image_hash: hash,
        name: input.headline,
        call_to_action: { type: "SHOP_NOW", value: { link: input.link } },
      },
    },
  });
  const ad = await graphPost<{ id: string }>(`${auth.account}/ads`, auth.accessToken, {
    name: input.name,
    adset_id: input.adsetId,
    creative: { creative_id: creative.id },
    status: input.status,
  });
  return { adId: ad.id, creativeId: creative.id };
}

/** Reads an existing ad set's interest/behaviour spec so a proven audience can be reused with different age/gender bounds. */
export async function getAdSetFlexibleSpec(adsetId: string) {
  const auth = await getMetaMarketingAuth();
  const data = await graphGet<{ targeting?: { flexible_spec?: Record<string, { id: string; name?: string }[]>[] } }>(adsetId, auth.accessToken, {
    fields: "targeting",
  });
  return data.targeting?.flexible_spec ?? [];
}

/** Searches Meta's interest graph — used when proposing new audiences by keyword. */
export async function searchInterests(query: string, limit = 8) {
  const auth = await getMetaMarketingAuth();
  const data = await graphGet<{ data: { id: string; name: string; audience_size_upper_bound?: number }[] }>("search", auth.accessToken, {
    type: "adinterest",
    q: query,
    limit: String(limit),
  });
  return (data.data ?? []).map((i) => ({ id: i.id, name: i.name, size: i.audience_size_upper_bound ?? null }));
}
