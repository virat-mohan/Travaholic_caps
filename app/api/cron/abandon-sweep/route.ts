import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getSetting } from "@/lib/settings";
import { sendAbandonedCartWhatsApp } from "@/lib/whatsapp-notify";
import { sendAbandonedCartEmail } from "@/lib/email";

const STALE_AFTER_MINUTES = 45;

async function assertAuthorized(request: Request) {
  const secret = await getSetting("CRON_SECRET");
  if (!secret) return true; // not configured yet — allow (dev/manual-trigger friendly)
  const provided = new URL(request.url).searchParams.get("secret") ?? request.headers.get("x-cron-secret");
  return provided === secret;
}

/**
 * Finds carts nobody finished checking out on, marks them abandoned, and
 * nudges them by email and/or WhatsApp (whichever contact info + provider
 * is available — email is the reliable one right now). Meant to be hit by
 * Vercel Cron on an interval (hourly is plenty) — Vercel's free tier limits
 * cron to once/day, so /admin/reports also exposes a manual "Run Sweep Now"
 * button that calls this same route.
 */
export async function GET(request: Request) {
  if (!(await assertAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const staleBefore = new Date(Date.now() - STALE_AFTER_MINUTES * 60 * 1000).toISOString();

    const { data: staleSessions, error } = await supabase
      .from("cart_sessions")
      .update({ status: "abandoned" })
      .eq("status", "active")
      .lt("last_activity_at", staleBefore)
      .select();
    if (error) throw error;

    let retargeted = 0;
    for (const session of staleSessions ?? []) {
      if (session.retargeted_at) continue;

      const [whatsappSent, emailSent] = await Promise.all([
        session.customer_phone
          ? sendAbandonedCartWhatsApp({
              id: session.id,
              customer_name: session.customer_name,
              customer_phone: session.customer_phone,
              items: session.items ?? [],
            })
          : false,
        sendAbandonedCartEmail({
          customer_name: session.customer_name,
          customer_email: session.customer_email,
          items: session.items ?? [],
        }),
      ]);

      if (whatsappSent || emailSent) {
        await supabase
          .from("cart_sessions")
          .update({ retargeted_at: new Date().toISOString() })
          .eq("id", session.id);
        retargeted++;
      }
    }

    return NextResponse.json({ abandoned: staleSessions?.length ?? 0, retargeted });
  } catch (err) {
    console.error("Abandon sweep failed", err);
    return NextResponse.json({ error: "Sweep failed" }, { status: 500 });
  }
}
