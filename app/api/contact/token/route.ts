import { NextResponse } from "next/server";
import { signFormTimestamp, contactSecret } from "@/lib/contact-spam";

export const dynamic = "force-dynamic";

/** Signed render timestamp for the contact form (time-to-submit check). */
export async function GET() {
  return NextResponse.json({ token: signFormTimestamp(Date.now(), contactSecret()) }, { headers: { "Cache-Control": "no-store" } });
}
