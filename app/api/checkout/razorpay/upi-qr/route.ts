import { NextResponse } from "next/server";
import { createUpiQrForOrder } from "@/lib/razorpay";
import { finalizePaidUpiQr } from "@/lib/upi-qr-fulfillment";

/** Creates the one-time rescue QR for a checkout whose payment failed. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const razorpayOrderId = body?.razorpayOrderId;
  if (typeof razorpayOrderId !== "string" || !razorpayOrderId.startsWith("order_")) {
    return NextResponse.json({ error: "Missing order" }, { status: 400 });
  }
  try {
    return NextResponse.json(await createUpiQrForOrder(razorpayOrderId));
  } catch (err) {
    console.error("UPI QR creation failed", err);
    return NextResponse.json({ error: "Could not create a QR right now" }, { status: 500 });
  }
}

/** Polled by the checkout page — finalizes the order the moment the QR is paid. */
export async function GET(request: Request) {
  const qrId = new URL(request.url).searchParams.get("qr");
  if (!qrId || !qrId.startsWith("qr_")) return NextResponse.json({ error: "Missing qr" }, { status: 400 });
  try {
    return NextResponse.json(await finalizePaidUpiQr(qrId));
  } catch (err) {
    console.error("UPI QR status check failed", err);
    return NextResponse.json({ paid: false });
  }
}
