import { NextResponse } from "next/server";
import { createRazorpayOrder } from "@/lib/razorpay";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.amount) {
    return NextResponse.json({ error: "Missing amount" }, { status: 400 });
  }

  try {
    const { razorpayOrderId, keyId } = await createRazorpayOrder(
      body.amount,
      `travaholic_${Date.now()}`
    );
    return NextResponse.json({ razorpayOrderId, keyId });
  } catch (err) {
    console.error("Failed to create Razorpay order", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not create Razorpay order" },
      { status: 500 }
    );
  }
}
