import { getSetting } from "@/lib/settings";

const GRAPH_VERSION = "v21.0";

/**
 * Posts a photo to the connected Instagram Business account's Story feed.
 * Requires the Instagram account to be a Business/Creator account connected
 * to the same Meta app as META_ACCESS_TOKEN. Best-effort — a missing setting
 * or a failed post never blocks the underlying admin action (e.g. approving
 * an Explorer submission).
 */
export async function postToInstagramStory(imageUrl: string) {
  const [accessToken, igUserId] = await Promise.all([
    getSetting("META_ACCESS_TOKEN"),
    getSetting("INSTAGRAM_BUSINESS_ACCOUNT_ID"),
  ]);

  if (!accessToken || !igUserId) {
    console.log("Instagram not configured — skipping Story post for", imageUrl);
    return false;
  }

  try {
    const createRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${igUserId}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: imageUrl,
          media_type: "STORIES",
          access_token: accessToken,
        }),
      }
    );
    const created = await createRes.json();
    if (!createRes.ok) throw new Error(JSON.stringify(created));

    const publishRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${igUserId}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creation_id: created.id, access_token: accessToken }),
      }
    );
    const published = await publishRes.json();
    if (!publishRes.ok) throw new Error(JSON.stringify(published));

    return true;
  } catch (err) {
    console.error("Instagram Story post failed", err);
    return false;
  }
}
