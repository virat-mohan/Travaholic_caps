import { getSupabaseServerClient } from "@/lib/supabase";

export const SETTINGS_KEYS = [
  "ANTHROPIC_API_KEY",
  "META_ACCESS_TOKEN",
  "META_AD_ACCOUNT_ID",
  "META_PAGE_ID",
  "INSTAGRAM_BUSINESS_ACCOUNT_ID",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RESEND_API_KEY",
  "INTERAKT_API_KEY",
  "IMAGE_GEN_API_KEY",
  "META_PIXEL_ID",
  "CRON_SECRET",
  "AGENT_ENABLED",
  "AGENT_MAX_DAILY_BUDGET_RUPEES",
  "MILES_PER_CAP",
] as const;

export type SettingKey = (typeof SETTINGS_KEYS)[number];

export async function getSetting(key: SettingKey): Promise<string | null> {
  try {
    const supabase = getSupabaseServerClient();
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    return data?.value ?? null;
  } catch {
    return null;
  }
}

export async function getAllSettingsMasked(): Promise<Record<SettingKey, boolean>> {
  try {
    const supabase = getSupabaseServerClient();
    const { data } = await supabase.from("app_settings").select("key");
    const present = new Set((data ?? []).map((r) => r.key));
    return Object.fromEntries(SETTINGS_KEYS.map((k) => [k, present.has(k)])) as Record<
      SettingKey,
      boolean
    >;
  } catch {
    return Object.fromEntries(SETTINGS_KEYS.map((k) => [k, false])) as Record<SettingKey, boolean>;
  }
}

export async function setSetting(key: SettingKey, value: string) {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
}
