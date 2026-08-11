import { NextResponse } from "next/server";
import { logTrackingEvent, type TrackingEventName } from "@/lib/tracking";

const VALID_EVENTS: TrackingEventName[] = [
  "PageView",
  "ViewContent",
  "AddToCart",
  "InitiateCheckout",
  "Purchase",
];

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.eventName || !VALID_EVENTS.includes(body.eventName)) {
    return NextResponse.json({ error: "Invalid eventName" }, { status: 400 });
  }

  await logTrackingEvent(body.eventName, {
    sessionKey: body.sessionKey,
    chapterSlug: body.chapterSlug,
    value: body.value,
  });

  return NextResponse.json({ ok: true });
}
