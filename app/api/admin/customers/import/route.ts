import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

type ColumnMapping = {
  name?: string;
  phone: string;
  email?: string;
  purchaseDate?: string;
  purchaseValue?: string;
  quantity?: string;
};

function normalizePhone(raw: string) {
  return raw.replace(/\D/g, "").slice(-10);
}

function parseNumber(raw: unknown) {
  if (raw == null || raw === "") return null;
  const n = Number(String(raw).replace(/[₹,\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : null;
}

function parseDate(raw: unknown) {
  if (!raw) return null;
  const d = new Date(String(raw));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const rows = body?.rows as Record<string, string>[] | undefined;
  const mapping = body?.mapping as ColumnMapping | undefined;
  const sourceFile = body?.sourceFile as string | undefined;

  if (!rows?.length || !mapping?.phone) {
    return NextResponse.json({ error: "Missing rows or phone column mapping" }, { status: 400 });
  }

  const records = rows
    .map((row) => {
      const phone = normalizePhone(row[mapping.phone] ?? "");
      if (phone.length !== 10) return null;
      return {
        name: mapping.name ? row[mapping.name] || null : null,
        phone,
        email: mapping.email ? row[mapping.email] || null : null,
        purchase_date: mapping.purchaseDate ? parseDate(row[mapping.purchaseDate]) : null,
        purchase_value: mapping.purchaseValue ? parseNumber(row[mapping.purchaseValue]) : null,
        quantity: mapping.quantity ? parseNumber(row[mapping.quantity]) : null,
        source_file: sourceFile ?? null,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const skipped = rows.length - records.length;

  if (records.length === 0) {
    return NextResponse.json({ error: "No rows had a valid phone number" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    // Insert in chunks — a large CSV as one request can hit payload/row limits.
    const CHUNK = 500;
    for (let i = 0; i < records.length; i += CHUNK) {
      const { error } = await supabase.from("imported_customer_records").insert(records.slice(i, i + CHUNK));
      if (error) throw error;
    }

    return NextResponse.json({ imported: records.length, skipped });
  } catch (err) {
    console.error("Failed to import customer records", err);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
