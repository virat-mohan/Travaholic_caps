import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { postToInstagramStory } from "@/lib/instagram";

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("explorer_submissions")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ submissions: data ?? [] });
  } catch (err) {
    console.error("Failed to list explorer submissions", err);
    return NextResponse.json({ submissions: [] }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.id || !body?.status) {
    return NextResponse.json({ error: "Missing id or status" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();

    if (body.chapterSlugs) {
      await supabase
        .from("explorer_submissions")
        .update({ chapter_slugs: body.chapterSlugs })
        .eq("id", body.id);
    }

    const { data: submission, error } = await supabase
      .from("explorer_submissions")
      .update({ status: body.status })
      .eq("id", body.id)
      .select()
      .single();
    if (error) throw error;

    if (body.status === "approved" && !submission.instagram_posted) {
      const posted = await postToInstagramStory(submission.photo_url);
      if (posted) {
        await supabase.from("explorer_submissions").update({ instagram_posted: true }).eq("id", body.id);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to update explorer submission", err);
    return NextResponse.json({ error: "Could not update submission" }, { status: 500 });
  }
}
