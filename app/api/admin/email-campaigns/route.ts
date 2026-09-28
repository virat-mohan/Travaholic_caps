import { NextResponse } from "next/server";
import { getWelcomeBack15Stats } from "@/lib/email-campaigns";

export async function GET() {
  return NextResponse.json(await getWelcomeBack15Stats());
}
