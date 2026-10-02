import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { sendContactFormEmail } from "@/lib/email";
import { getSupabaseServerClient } from "@/lib/supabase";
import { RATE_LIMIT, spamReason, contactSecret } from "@/lib/contact-spam";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (!name || !email || !message) {
    return NextResponse.json({ error: "Name, email, and message are required" }, { status: 400 });
  }

  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const ipHash = createHash("sha256").update(ip).digest("hex");
  const supabase = getSupabaseServerClient();

  let recentFromIp = 0;
  try {
    const since = new Date(Date.now() - RATE_LIMIT.windowMs).toISOString();
    const { count } = await supabase
      .from("contact_submissions")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", since);
    recentFromIp = count ?? 0;
  } catch {}

  const reason = spamReason({
    name, message, honeypot: body?.website, token: body?.formToken, secret: contactSecret(), recentFromIp,
  });

  await supabase
    .from("contact_submissions")
    .insert({ name: name.slice(0, 200), email: email.slice(0, 200), message: message.slice(0, 5000), ip_hash: ipHash, is_spam: !!reason, spam_reason: reason })
    .then(() => {}, () => {});

  // Spam is accepted silently so bots learn nothing.
  if (reason) return NextResponse.json({ ok: true });

  try {
    await sendContactFormEmail(name, email, message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Contact form send failed", err);
    return NextResponse.json({ error: "Could not send your message" }, { status: 500 });
  }
}
