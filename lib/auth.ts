import crypto from "crypto";
import { cookies } from "next/headers";
import { getSupabaseServerClient } from "@/lib/supabase";
import { sendOtpViaMsg91 } from "@/lib/msg91";
import { sendOtpEmail } from "@/lib/email";

export const SESSION_COOKIE_NAME = "travaholic_session";
const OTP_TTL_MINUTES = 10;
const SESSION_TTL_DAYS = 30;

export type Customer = {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  newsletter_subscribed: boolean;
  created_at: string;
};

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "").slice(-10);
}

/**
 * Generates a 6-digit code, stores it, and sends it — email is the primary
 * channel right now (WhatsApp/SMS via MSG91 is still being set up, so it's
 * attempted best-effort alongside but not relied on). Email is required for
 * this reason; phone stays the account's actual identity.
 */
export async function requestOtp(rawPhone: string, email: string) {
  const phone = normalizePhone(rawPhone);
  if (phone.length !== 10) throw new Error("Enter a valid 10-digit phone number");
  if (!email || !email.includes("@")) throw new Error("Enter a valid email address");

  const code = String(crypto.randomInt(100000, 999999));
  const supabase = getSupabaseServerClient();

  const { error } = await supabase.from("otp_codes").insert({
    phone,
    email,
    code,
    expires_at: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString(),
  });
  if (error) throw error;

  const [emailSent, whatsappSent] = await Promise.all([
    sendOtpEmail(email, code),
    sendOtpViaMsg91(phone, code),
  ]);
  const sent = emailSent || whatsappSent;
  if (!sent) {
    // Nothing configured yet — surface the code so the flow is still
    // testable end-to-end without messaging set up.
    console.log(`[dev only] OTP for ${phone} / ${email}: ${code}`);
  }

  return { sent };
}

/**
 * Verifies a code, creating the customer record on first-ever login, and
 * returns a session token to set as an httpOnly cookie. Never throws for
 * "wrong code" — returns null so the caller can show a normal error instead
 * of a 500.
 */
export async function verifyOtp(rawPhone: string, code: string) {
  const phone = normalizePhone(rawPhone);
  const supabase = getSupabaseServerClient();

  const { data: otp } = await supabase
    .from("otp_codes")
    .select("id, email, expires_at, consumed")
    .eq("phone", phone)
    .eq("code", code)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!otp || otp.consumed || new Date(otp.expires_at) < new Date()) return null;

  await supabase.from("otp_codes").update({ consumed: true }).eq("id", otp.id);

  const { data: existing } = await supabase
    .from("customers")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();

  let customer = existing as Customer | null;
  if (!customer) {
    const { data: created, error } = await supabase
      .from("customers")
      .insert({ phone, email: otp.email ?? null })
      .select()
      .single();
    if (error) throw error;
    customer = created as Customer;
  } else if (otp.email && otp.email !== customer.email) {
    // Keep the email on file current — this is the only place it's
    // reliably re-collected on every login.
    await supabase.from("customers").update({ email: otp.email }).eq("id", customer.id);
    customer = { ...customer, email: otp.email };
  }

  const token = crypto.randomBytes(32).toString("hex");
  const { error: sessionError } = await supabase.from("customer_sessions").insert({
    token,
    customer_id: customer.id,
    expires_at: new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (sessionError) throw sessionError;

  return { token, customer, isNewCustomer: !existing };
}

export async function getCustomerFromToken(token: string | undefined | null): Promise<Customer | null> {
  if (!token) return null;
  try {
    const supabase = getSupabaseServerClient();
    const { data: session } = await supabase
      .from("customer_sessions")
      .select("customer_id, expires_at")
      .eq("token", token)
      .maybeSingle();
    if (!session || new Date(session.expires_at) < new Date()) return null;

    const { data: customer } = await supabase
      .from("customers")
      .select("*")
      .eq("id", session.customer_id)
      .maybeSingle();
    return customer ?? null;
  } catch (err) {
    console.error("Failed to resolve customer session", err);
    return null;
  }
}

/** Server Component / Route Handler helper — reads the session cookie directly. */
export async function getCurrentCustomer(): Promise<Customer | null> {
  const cookieStore = await cookies();
  return getCustomerFromToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}

export async function destroySession(token: string) {
  const supabase = getSupabaseServerClient();
  await supabase.from("customer_sessions").delete().eq("token", token);
}
