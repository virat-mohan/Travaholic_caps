import { NextResponse } from "next/server";
import { getShippingRate } from "@/lib/shiprocket";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const pincode = String(body?.pincode ?? "").trim();
  const unitCount = Number(body?.unitCount ?? 1);

  if (!/^\d{6}$/.test(pincode)) {
    return NextResponse.json({ error: "Invalid pincode" }, { status: 400 });
  }

  const rate = await getShippingRate(pincode, unitCount || 1);
  if (rate === null) {
    return NextResponse.json({ available: false });
  }
  return NextResponse.json({ available: true, rate });
}
