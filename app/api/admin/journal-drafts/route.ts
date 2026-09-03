import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { generateJournalDraft } from "@/lib/claude";

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("journal_drafts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ drafts: data ?? [] });
  } catch (err) {
    console.error("Failed to list journal drafts", err);
    return NextResponse.json({ drafts: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.topic) {
    return NextResponse.json({ error: "Missing topic" }, { status: 400 });
  }

  try {
    const draft = await generateJournalDraft(body.topic);
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("journal_drafts")
      .insert({
        topic: body.topic,
        title: draft.title,
        subtitle: draft.subtitle,
        category: draft.category,
        excerpt: draft.excerpt,
        body: draft.body,
        related_chapter_slugs: draft.relatedChapterSlugs,
        reading_time: draft.readingTime,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ draft: data });
  } catch (err) {
    console.error("Failed to generate journal draft", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not generate draft" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.id || !body?.status) {
    return NextResponse.json({ error: "Missing id or status" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from("journal_drafts")
      .update({ status: body.status })
      .eq("id", body.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to update journal draft", err);
    return NextResponse.json({ error: "Could not update draft" }, { status: 500 });
  }
}
