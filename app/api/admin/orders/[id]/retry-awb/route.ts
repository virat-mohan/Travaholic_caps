import { NextResponse } from "next/server";
import { retryAwbAssignment } from "@/lib/order-shipping";

export const maxDuration = 120;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const result = await retryAwbAssignment(id);
    return NextResponse.json(result);
  } catch (err) {
    console.error("AWB retry failed", id, err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Retry failed" }, { status: 500 });
  }
}
