import { getSupabaseServerClient } from "@/lib/supabase";
import { getSetting } from "@/lib/settings";
import { getBrandProfile } from "@/lib/brand";
import { sendMessage } from "@/lib/meta-bot";
import { sendEmail } from "@/lib/email";
import { sendWhatsAppSessionMessage } from "@/lib/msg91";

const GRAPH_VERSION = "v21.0";
const STORAGE_BUCKET = "chapter-images";

/**
 * Someone tagged the brand in an Instagram Story. Meta delivers this as a
 * DM webhook event carrying a `story_mention` attachment whose CDN URL only
 * lives ~24h, so the media is copied into our own storage immediately.
 *
 * Deliberately approve-first: the story lands in the Explorer submissions
 * queue as "pending", and the existing one-tap Approve there both reposts
 * it to our Story and puts it on the Explorers wall. Anything can be
 * tagged at us — a blurry shot, a competitor in frame, a troll — so the
 * only thing that happens automatically is the thank-you DM.
 */
export async function handleStoryMention(senderId: string, mediaUrl: string) {
  const supabase = getSupabaseServerClient();
  const accessToken = await getSetting("META_ACCESS_TOKEN");
  const brand = await getBrandProfile();

  let username: string | null = null;
  if (accessToken) {
    try {
      const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${senderId}?fields=username,name&access_token=${accessToken}`);
      const data = await res.json();
      if (res.ok) username = data.username ?? data.name ?? null;
    } catch {
      // best-effort — the handle is nice to have, not required
    }
  }

  // Copy the media out of Meta's expiring CDN link.
  let storedUrl: string | null = null;
  try {
    const media = await fetch(mediaUrl);
    if (media.ok) {
      const contentType = media.headers.get("content-type") ?? "image/jpeg";
      const ext = contentType.includes("video") ? "mp4" : contentType.includes("png") ? "png" : "jpg";
      const bytes = new Uint8Array(await media.arrayBuffer());
      const path = `story-mentions/${Date.now()}-${senderId}.${ext}`;
      const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, bytes, { contentType, upsert: false });
      if (!error) storedUrl = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
    }
  } catch (err) {
    console.error("Story mention media copy failed", err);
  }
  if (!storedUrl) {
    console.error("Story mention: could not store media, skipping", senderId);
    return false;
  }

  const handle = username ? `@${username}` : "an explorer";
  const { data: submission } = await supabase
    .from("explorer_submissions")
    .insert({
      photo_url: storedUrl,
      testimonial: `${handle} tagged ${brand.instagramHandle} in a Story`,
      location: null,
      email: null,
      chapter_slugs: [],
      status: "pending",
    })
    .select("id")
    .single();

  // Thank them right away — the reshare waits for a human tap.
  await sendMessage(
    senderId,
    `Thank you for wearing ${brand.brandName} and tagging us 🧢 We loved your story — we're sharing it on our page. Want it on our Explorers wall permanently? Just reply with where the photo was taken.`
  ).catch(() => false);

  // Nudge the owner to approve.
  const adminUrl = `${brand.siteUrl.replace(/\/$/, "")}/admin/explorer-submissions`;
  const text = `New Story tag from ${handle}. Tap Approve to post it to our Story + Explorers wall: ${adminUrl}`;
  const [waNumber, emailSetting, warehouseEmail] = await Promise.all([
    getSetting("PM_ALERT_WHATSAPP"),
    getSetting("PM_ALERT_EMAIL"),
    getSetting("WAREHOUSE_EMAIL"),
  ]);
  if (waNumber) await sendWhatsAppSessionMessage(waNumber, text).catch(() => null);
  const to = (emailSetting || warehouseEmail || "").split(",")[0]?.trim();
  if (to) {
    await sendEmail(
      to,
      `Story tag from ${handle} — approve to repost`,
      `<p>${text.replace(adminUrl, `<a href="${adminUrl}">${adminUrl}</a>`)}</p><p><img src="${storedUrl}" alt="" style="max-width:360px"></p>`
    ).catch(() => false);
  }

  return !!submission;
}
