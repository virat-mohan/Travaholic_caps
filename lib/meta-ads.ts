import { getSetting } from "@/lib/settings";
import { getBrandProfile } from "@/lib/brand";

const GRAPH_VERSION = "v21.0";

async function getMetaCredentials() {
  const [accessToken, adAccountId, pageId] = await Promise.all([
    getSetting("META_ACCESS_TOKEN"),
    getSetting("META_AD_ACCOUNT_ID"),
    getSetting("META_PAGE_ID"),
  ]);
  if (!accessToken || !adAccountId || !pageId) return null;
  return { accessToken, adAccountId, pageId };
}

async function graphPost(path: string, accessToken: string, body: Record<string, unknown>) {
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, access_token: accessToken }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Meta Graph API error: ${JSON.stringify(data)}`);
  return data;
}

async function graphGet(path: string, accessToken: string, params: Record<string, string> = {}) {
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${path}?` +
      new URLSearchParams({ ...params, access_token: accessToken })
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Meta Graph API error: ${JSON.stringify(data)}`);
  return data;
}

/**
 * Creates a Campaign, Ad Set and Ad on Meta — all PAUSED. Nothing this
 * function does can ever spend money on its own; a human has to open Meta
 * Ads Manager and flip the campaign to ACTIVE before it runs.
 */
export async function createPausedMetaCampaign(brief: {
  headline: string;
  primaryText: string;
  cta: string;
  imageUrl: string;
  landingUrl: string;
  dailyBudgetRupees: number;
  hashtags?: string[];
}) {
  const creds = await getMetaCredentials();
  if (!creds) {
    throw new Error(
      "Meta is not fully configured yet — add META_ACCESS_TOKEN, META_AD_ACCOUNT_ID and META_PAGE_ID in /admin/settings"
    );
  }
  const brand = await getBrandProfile();
  const account = `act_${creds.adAccountId.replace(/^act_/, "")}`;

  const campaign = await graphPost(`${account}/campaigns`, creds.accessToken, {
    name: `${brand.brandName} — ${brief.headline}`,
    objective: "OUTCOME_TRAFFIC",
    status: "PAUSED",
    special_ad_categories: [],
  });

  const adSet = await graphPost(`${account}/adsets`, creds.accessToken, {
    name: `${brief.headline} — Ad Set`,
    campaign_id: campaign.id,
    daily_budget: Math.round(brief.dailyBudgetRupees * 100),
    billing_event: "IMPRESSIONS",
    optimization_goal: "LINK_CLICKS",
    targeting: { geo_locations: { countries: ["IN"] } },
    status: "PAUSED",
  });

  const imageUpload = await graphPost(`${account}/adimages`, creds.accessToken, {
    url: brief.imageUrl,
  });
  const imageHash = Object.values(imageUpload.images ?? {})[0] as { hash: string } | undefined;
  if (!imageHash) throw new Error("Meta did not return an image hash for the uploaded creative");

  // Caption + hashtags are generated together in the ad brief so nothing
  // gets typed by hand right before posting — appended here as the trailing
  // hashtag block convention Instagram/Facebook copy normally uses.
  const message =
    brief.hashtags && brief.hashtags.length > 0
      ? `${brief.primaryText}\n\n${brief.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}`
      : brief.primaryText;

  const creative = await graphPost(`${account}/adcreatives`, creds.accessToken, {
    name: `${brief.headline} — Creative`,
    object_story_spec: {
      page_id: creds.pageId,
      link_data: {
        message,
        link: brief.landingUrl,
        image_hash: imageHash.hash,
        name: brief.headline,
        call_to_action: { type: brief.cta, value: { link: brief.landingUrl } },
      },
    },
  });

  const ad = await graphPost(`${account}/ads`, creds.accessToken, {
    name: `${brief.headline} — Ad`,
    adset_id: adSet.id,
    creative: { creative_id: creative.id },
    status: "PAUSED",
  });

  return { campaignId: campaign.id as string, adSetId: adSet.id as string, adId: ad.id as string };
}

/**
 * True only if a human has flipped the campaign to ACTIVE in Meta Ads
 * Manager. The ad agent checks this before touching anything — it is never
 * allowed to activate a campaign itself, only to pause or resize spend on
 * one a human already turned on.
 */
export async function isCampaignActive(campaignId: string) {
  const creds = await getMetaCredentials();
  if (!creds) return false;
  const data = await graphGet(campaignId, creds.accessToken, { fields: "status" });
  return data.status === "ACTIVE";
}

export async function pauseCampaign(campaignId: string) {
  const creds = await getMetaCredentials();
  if (!creds) throw new Error("Meta is not configured");
  await graphPost(campaignId, creds.accessToken, { status: "PAUSED" });
}

export async function getAdSetDailyBudgetRupees(adSetId: string) {
  const creds = await getMetaCredentials();
  if (!creds) throw new Error("Meta is not configured");
  const data = await graphGet(adSetId, creds.accessToken, { fields: "daily_budget" });
  return Math.round(Number(data.daily_budget ?? 0) / 100);
}

export async function updateAdSetDailyBudgetRupees(adSetId: string, newBudgetRupees: number) {
  const creds = await getMetaCredentials();
  if (!creds) throw new Error("Meta is not configured");
  await graphPost(adSetId, creds.accessToken, { daily_budget: Math.round(newBudgetRupees * 100) });
}
