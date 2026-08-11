import { NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/settings";

export async function GET() {
  const milesPerCap = await getSetting("MILES_PER_CAP");
  return NextResponse.json({ milesPerCap: milesPerCap ? Number(milesPerCap) : 100 });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  if (body?.milesPerCap == null) {
    return NextResponse.json({ error: "Missing milesPerCap" }, { status: 400 });
  }

  try {
    await setSetting("MILES_PER_CAP", String(body.milesPerCap));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to save loyalty config", err);
    return NextResponse.json({ error: "Could not save loyalty config" }, { status: 500 });
  }
}
