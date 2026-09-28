import { NextResponse } from "next/server";
import { getWelcomeBack15Stats, sendWelcomeBack15Batch } from "@/lib/email-campaigns";

export const maxDuration = 300;

export async function GET() {
  return NextResponse.json(await getWelcomeBack15Stats());
}

/** "Send next batch now" — same as the daily cron, within today's Brevo allowance. */
export async function POST() {
  return NextResponse.json(await sendWelcomeBack15Batch());
}
