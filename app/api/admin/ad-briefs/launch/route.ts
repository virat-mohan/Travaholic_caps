import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { createPausedMetaCampaign } from "@/lib/meta-ads";
import { getBrandProfile } from "@/lib/brand";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const supabase = getSupabaseServerClient();
    const { data: brief } = await supabase.from("ad_briefs").select("*").eq("id", body.id).maybeSingle();
    if (!brief) return NextResponse.json({ error: "Brief not found" }, { status: 404 });
    if (!brief.image_url) {
      return NextResponse.json({ error: "Generate or attach an image before launching" }, { status: 400 });
    }

    const brand = await getBrandProfile();
    const baseUrl = brief.chapter_slug ? `${brand.siteUrl}/chapter/${brief.chapter_slug}` : brand.siteUrl;
    // `ab` (ad brief id) is what makes attribution real rather than a
    // blended account-wide estimate — every click from this specific ad
    // carries it, the client persists it through the session, and it lands
    // on the order it eventually produces. See lib/client-tracking.ts and
    // the attribution capture on order creation.
    const landingUrl = `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}ab=${brief.id}`;

    const { campaignId, adSetId, adId } = await createPausedMetaCampaign({
      headline: brief.headline,
      primaryText: brief.primary_text,
      cta: brief.cta,
      imageUrl: brief.image_url,
      landingUrl,
      dailyBudgetRupees: body.dailyBudgetRupees ?? 500,
      hashtags: brief.hashtags ?? undefined,
    });

    const { error } = await supabase
      .from("ad_briefs")
      .update({
        status: "launched",
        meta_campaign_id: campaignId,
        meta_adset_id: adSetId,
        meta_ad_id: adId,
      })
      .eq("id", body.id);
    if (error) throw error;

    return NextResponse.json({ campaignId, adSetId, adId });
  } catch (err) {
    console.error("Failed to launch Meta campaign", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not launch campaign" },
      { status: 500 }
    );
  }
}
