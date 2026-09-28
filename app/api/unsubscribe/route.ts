import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { unsubscribeToken } from "@/lib/email-campaigns";

async function unsubscribe(request: Request) {
  const url = new URL(request.url);
  const email = (url.searchParams.get("e") ?? "").trim().toLowerCase();
  const token = url.searchParams.get("t") ?? "";
  if (!email || token !== unsubscribeToken(email)) {
    return new NextResponse("Invalid unsubscribe link.", { status: 400 });
  }
  await getSupabaseServerClient().from("email_unsubscribes").upsert({ email }, { onConflict: "email" });
  return new NextResponse(
    `<!doctype html><meta name="viewport" content="width=device-width"><body style="font-family:Helvetica,Arial,sans-serif;background:#f0eee4;color:#101820;padding:48px 20px;text-align:center"><h1 style="font-size:22px">You're unsubscribed.</h1><p>You won't get marketing emails from Travaholic any more. Order and delivery updates still come through.</p><p><a href="https://www.travaholic.in" style="color:#101820">travaholic.in</a></p></body>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export const GET = unsubscribe;
// One-click unsubscribe from the mail app (List-Unsubscribe-Post).
export const POST = unsubscribe;
