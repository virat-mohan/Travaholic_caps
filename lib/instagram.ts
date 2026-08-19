import { getSetting } from "@/lib/settings";

const GRAPH_VERSION = "v21.0";

async function getInstagramAuth() {
  const [accessToken, igUserId] = await Promise.all([
    getSetting("META_ACCESS_TOKEN"),
    getSetting("INSTAGRAM_BUSINESS_ACCOUNT_ID"),
  ]);
  if (!accessToken || !igUserId) {
    throw new Error("Instagram is not configured — add META_ACCESS_TOKEN and INSTAGRAM_BUSINESS_ACCOUNT_ID in /admin/settings");
  }
  return { accessToken, igUserId };
}

async function igPost(path: string, accessToken: string, body: Record<string, unknown>) {
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, access_token: accessToken }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Instagram Graph API error: ${JSON.stringify(data)}`);
  return data;
}

/**
 * Publishes a single-image feed post — a real, permanent post on the
 * Instagram grid, not a paid ad and not a 24-hour Story. Throws on
 * failure rather than swallowing it (unlike postToInstagramStory below),
 * since this is always an explicit admin action, never a best-effort
 * side-effect of something else.
 */
export async function postToInstagramFeed(imageUrl: string, caption: string) {
  const { accessToken, igUserId } = await getInstagramAuth();

  const created = await igPost(`${igUserId}/media`, accessToken, { image_url: imageUrl, caption });
  const published = await igPost(`${igUserId}/media_publish`, accessToken, { creation_id: created.id });

  return { postId: published.id as string };
}

/**
 * Publishes a carousel feed post — each image is first uploaded as its own
 * unpublished carousel-item container (is_carousel_item: true, no caption
 * of its own), then a parent container references all of them via
 * children, and that parent is what actually gets published.
 */
export async function postToInstagramCarouselFeed(imageUrls: string[], caption: string) {
  const { accessToken, igUserId } = await getInstagramAuth();
  if (imageUrls.length < 2) throw new Error("A carousel post needs at least 2 images");

  const childIds: string[] = [];
  for (const imageUrl of imageUrls) {
    const item = await igPost(`${igUserId}/media`, accessToken, {
      image_url: imageUrl,
      is_carousel_item: true,
    });
    childIds.push(item.id);
  }

  const container = await igPost(`${igUserId}/media`, accessToken, {
    media_type: "CAROUSEL",
    children: childIds,
    caption,
  });
  const published = await igPost(`${igUserId}/media_publish`, accessToken, { creation_id: container.id });

  return { postId: published.id as string };
}

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
