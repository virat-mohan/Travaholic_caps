import { getSupabaseServerClient } from "@/lib/supabase";

export type LeadSource = "meta_dm" | "meta_comment" | "website" | "other";
export type LeadType = "buying" | "collaborating" | "general_enquiry" | "restock_notify";

export async function createLead(input: {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  source: LeadSource;
  leadType?: LeadType | null;
  platform?: "instagram" | "facebook" | null;
  metaUserId?: string | null;
  note?: string | null;
  status?: "new" | "contacted" | "converted" | "closed";
  chapterSlug?: string | null;
}) {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("leads")
    .insert({
      name: input.name ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      source: input.source,
      lead_type: input.leadType ?? null,
      platform: input.platform ?? null,
      meta_user_id: input.metaUserId ?? null,
      note: input.note ?? null,
      status: input.status ?? "new",
      chapter_slug: input.chapterSlug ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

