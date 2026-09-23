import { NextResponse } from "next/server";
import { getRazorpayCredentials } from "@/lib/razorpay";
import { getCodAdvanceRupees } from "@/lib/order-pricing";
import { isPostBarterEnabled, getPostBarterConfig } from "@/lib/post-barter";

export async function GET() {
  const [creds, codAdvanceRupees, postBarterEnabled, postBarterConfig] = await Promise.all([
    getRazorpayCredentials(),
    getCodAdvanceRupees(),
    isPostBarterEnabled(),
    getPostBarterConfig(),
  ]);
  return NextResponse.json({
    razorpayEnabled: !!creds,
    razorpayKeyId: creds?.keyId ?? null,
    codAdvanceRupees,
    postBarterEnabled,
    postBarterMinFollowers: postBarterConfig.minFollowers,
    postBarterRequiredOrders: postBarterConfig.requiredOrders,
  });
}
