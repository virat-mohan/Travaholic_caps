import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawAmount = searchParams.get("am") || "1399";
  const amount = parseInt(rawAmount.replace(/\D/g, ""), 10) || 1399;
  const item = searchParams.get("item") || "cap";

  const configuredUpiVpa = await getSetting("BUSINESS_UPI_ID");
  const upiId = configuredUpiVpa || "viratmohan-1@okhdfcbank";

  const configuredPayeeName = await getSetting("BUSINESS_UPI_NAME");
  const payeeName = configuredPayeeName || "Travaholic Caps";

  const note = `Travaholic Order (${item})`;
  const upiUri = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(upiUri)}`;

  return NextResponse.redirect(qrImageUrl, 302);
}
