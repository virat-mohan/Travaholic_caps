import { NextResponse } from "next/server";
import { getRazorpayCredentials } from "@/lib/razorpay";

export async function GET() {
  const creds = await getRazorpayCredentials();
  return NextResponse.json({
    razorpayEnabled: !!creds,
    razorpayKeyId: creds?.keyId ?? null,
  });
}
