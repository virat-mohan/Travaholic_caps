import { NextResponse } from "next/server";
import { logTrackingEvent, type TrackingEventName } from "@/lib/tracking";
import { toTrackingValue, toCheckoutStepPath } from "@/lib/money-rules";

const VALID_EVENTS: TrackingEventName[] = [
  "PageView",
  "ViewContent",
  "AddToCart",
  "InitiateCheckout",
  "Purchase",
  "CheckoutStep",
];

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.eventName || !VALID_EVENTS.includes(body.eventName)) {
    return NextResponse.json({ error: "Invalid eventName" }, { status: 400 });
  }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // CheckoutStep rows must carry a /checkout#<step> path or the funnel can't read them.
  let path = typeof body.path === "string" ? body.path.slice(0, 500) : undefined;
  if (body.eventName === "CheckoutStep") {
    const fromStep = toCheckoutStepPath(body.step ?? (path?.startsWith("/checkout#") ? path.slice(10) : undefined));
    if (!fromStep) return NextResponse.json({ error: "Missing step" }, { status: 400 });
    path = fromStep;
  }

  await logTrackingEvent(body.eventName, {
    sessionKey: body.sessionKey,
    chapterSlug: body.chapterSlug,
    value: toTrackingValue(body.value),
    path,
    referrerHost: typeof body.referrerHost === "string" ? body.referrerHost.slice(0, 200) : undefined,
    adBriefId: typeof body.adBriefId === "string" && UUID_RE.test(body.adBriefId) ? body.adBriefId : undefined,
    utmSource: typeof body.utmSource === "string" ? body.utmSource.slice(0, 100) : undefined,
  });

  return NextResponse.json({ ok: true });
}
