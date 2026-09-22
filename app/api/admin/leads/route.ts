import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    // "buying" leads were a completed-purchase record written on every
    // guest checkout — fully redundant with /admin/orders and the merged
    // customer view in /admin/customers (guest checkout creates/finds a
    // real customers row too), so they're excluded here rather than mixed
    // in with genuine pre-purchase leads (DM/comment inquiries, restock
    // signups). Rows still exist in the table, just not shown.
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      // Plain .neq excludes NULL lead_type rows too (SQL's NULL <> 'x' is
      // neither true nor false) — .or keeps those alongside everything
      // that's explicitly some other type.
      .or("lead_type.is.null,lead_type.neq.buying")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ leads: data ?? [] });
  } catch (err) {
    console.error("Failed to list leads", err);
    return NextResponse.json({ leads: [] }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.id || !body?.status) {
    return NextResponse.json({ error: "Missing id or status" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("leads").update({ status: body.status }).eq("id", body.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to update lead", err);
    return NextResponse.json({ error: "Could not update lead" }, { status: 500 });
  }
}
