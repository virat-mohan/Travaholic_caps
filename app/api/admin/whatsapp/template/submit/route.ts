import { NextResponse } from "next/server";
import { submitSupportFollowupTemplate } from "@/lib/msg91-templates";

// Admin-only (proxy.ts gates /api/admin/*). Submits support_followup only.
export async function POST() {
  try {
    return NextResponse.json(await submitSupportFollowupTemplate());
  } catch (err) {
    return NextResponse.json({ ok: false, detail: err instanceof Error ? err.message : "Request failed" }, { status: 500 });
  }
}
