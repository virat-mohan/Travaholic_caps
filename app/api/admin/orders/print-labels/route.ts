import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { mergeLabelsToA4 } from "@/lib/label-print";

/** Merges the shipping labels for the given order ids into one PDF, two labels per A4 page — see lib/label-print.ts. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  // Accepts either repeated ?ids=a&ids=b (a plain HTML checkbox form submits
  // this way) or one comma-separated ?ids=a,b.
  const ids = params.getAll("ids").flatMap((v) => v.split(",")).filter(Boolean);
  if (ids.length === 0) {
    return NextResponse.json({ error: "Missing ids" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const { data: orders, error } = await supabase
      .from("orders")
      .select("id, shiprocket_shipment_id, shiprocket_label_url")
      .in("id", ids);
    if (error) throw error;
    if (!orders || orders.length === 0) {
      return NextResponse.json({ error: "No matching orders found" }, { status: 404 });
    }

    const pdfBytes = await mergeLabelsToA4(orders);
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="labels-${new Date().toISOString().slice(0, 10)}.pdf"`,
      },
    });
  } catch (err) {
    console.error("Failed to print labels", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not print labels" },
      { status: 500 }
    );
  }
}
