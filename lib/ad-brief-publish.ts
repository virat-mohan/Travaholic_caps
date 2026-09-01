import { getSupabaseServerClient } from "@/lib/supabase";
import { postToInstagramFeed, postToInstagramCarouselFeed } from "@/lib/instagram";
import { createPausedMetaCampaign, createPausedMetaCarouselCampaign, type AdTargeting } from "@/lib/meta-ads";
import { getBrandProfile } from "@/lib/brand";

function buildCaption(brief: { primary_text: string; hashtags: string[] | null }) {
  return brief.hashtags && brief.hashtags.length > 0
    ? `${brief.primary_text}\n\n${brief.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}`
    : brief.primary_text;
}

/** Publishes a brief's copy/image straight to Instagram as an organic feed post — no ad spend. */
export async function postBriefToInstagram(briefId: string) {
  const supabase = getSupabaseServerClient();
  const { data: brief } = await supabase.from("ad_briefs").select("*").eq("id", briefId).maybeSingle();
  if (!brief) throw new Error("Brief not found");
  if (brief.posted_at) throw new Error("This brief has already been posted");

  const caption = buildCaption(brief);

  let postId: string;
  if (brief.is_carousel) {
    const images: string[] = (brief.image_urls ?? []).filter((url: string | null): url is string => !!url);
    const required = Math.max(brief.image_prompts?.length ?? 0, 2);
    if (images.length < required) {
      throw new Error(`Generate or attach all ${required} carousel images before posting`);
    }
    ({ postId } = await postToInstagramCarouselFeed(images, caption));
  } else {
    if (!brief.image_url) throw new Error("Generate or attach an image before posting");
    ({ postId } = await postToInstagramFeed(brief.image_url, caption));
  }

  const { error } = await supabase
    .from("ad_briefs")
    .update({ posted_at: new Date().toISOString(), instagram_post_id: postId, queue_status: "published" })
    .eq("id", briefId);
  if (error) throw error;

  return { postId };
}

/** Creates a PAUSED Meta campaign/ad set/ad from a brief. Never activates it. */
export async function launchBriefCampaign(
  briefId: string,
  options: { dailyBudgetRupees: number; cta?: string; targeting?: AdTargeting }
) {
  const supabase = getSupabaseServerClient();
  const { data: brief } = await supabase.from("ad_briefs").select("*").eq("id", briefId).maybeSingle();
  if (!brief) throw new Error("Brief not found");

  const carouselImages: string[] = brief.is_carousel
    ? (brief.image_urls ?? []).filter((url: string | null): url is string => !!url)
    : [];
  if (brief.is_carousel) {
    const required = Math.max(brief.image_prompts?.length ?? 0, 2);
    if (carouselImages.length < required) {
      throw new Error(`Generate or attach all ${required} carousel images before launching`);
    }
  }
  if (!brief.is_carousel && !brief.image_url) {
    throw new Error("Generate or attach an image before launching");
  }

  const brand = await getBrandProfile();
  const baseUrl = brief.chapter_slug ? `${brand.siteUrl}/chapter/${brief.chapter_slug}` : brand.siteUrl;
  const landingUrl = `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}ab=${brief.id}`;
  const cta = options.cta || brief.ad_cta_override || brief.cta;
  const targeting: AdTargeting = options.targeting ?? {
    ageMin: brief.ad_age_min,
    ageMax: brief.ad_age_max,
    gender: brief.ad_gender,
  };

  const { campaignId, adSetId, adId } = brief.is_carousel
    ? await createPausedMetaCarouselCampaign({
        headline: brief.headline,
        primaryText: brief.primary_text,
        cta,
        imageUrls: carouselImages,
        landingUrl,
        dailyBudgetRupees: options.dailyBudgetRupees,
        hashtags: brief.hashtags ?? undefined,
        targeting,
      })
    : await createPausedMetaCampaign({
        headline: brief.headline,
        primaryText: brief.primary_text,
        cta,
        imageUrl: brief.image_url,
        landingUrl,
        dailyBudgetRupees: options.dailyBudgetRupees,
        hashtags: brief.hashtags ?? undefined,
        targeting,
      });

  const { error } = await supabase
    .from("ad_briefs")
    .update({
      status: "launched",
      meta_campaign_id: campaignId,
      meta_adset_id: adSetId,
      meta_ad_id: adId,
      launched_at: new Date().toISOString(),
      queue_status: "published",
    })
    .eq("id", briefId);
  if (error) throw error;

  return { campaignId, adSetId, adId };
}
