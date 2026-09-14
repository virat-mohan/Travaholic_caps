import { PDFDocument, type PDFEmbeddedPage } from "pdf-lib";
import { generateShiprocketLabelsBatch } from "@/lib/shiprocket";
import { getSupabaseServerClient } from "@/lib/supabase";

// Landscape A4.
const A4_WIDTH = 841.89;
const A4_HEIGHT = 595.28;

function drawDuplicatedPage(outDoc: PDFDocument, embedded: PDFEmbeddedPage) {
  const page = outDoc.addPage([A4_WIDTH, A4_HEIGHT]);
  const halfWidth = A4_WIDTH / 2;
  const margin = 24;
  const maxWidth = halfWidth - margin * 2;
  const maxHeight = A4_HEIGHT - margin * 2;
  const scale = Math.min(maxWidth / embedded.width, maxHeight / embedded.height);
  const drawWidth = embedded.width * scale;
  const drawHeight = embedded.height * scale;
  const y = (A4_HEIGHT - drawHeight) / 2;

  for (const slotLeft of [0, halfWidth]) {
    const x = slotLeft + (halfWidth - drawWidth) / 2;
    page.drawPage(embedded, { x, y, width: drawWidth, height: drawHeight });
  }

  // A faint cut line down the middle, between the two identical copies.
  page.drawLine({
    start: { x: halfWidth, y: 0 },
    end: { x: halfWidth, y: A4_HEIGHT },
    thickness: 0.5,
    dashArray: [4, 4],
    opacity: 0.4,
  });
}

/**
 * Fetches each given order's Shiprocket shipping label — in ONE batch call
 * for all of them together (see generateShiprocketLabelsBatch: calling it
 * once per order separately can return the same cached label_url for each,
 * which is a real trap here) — and builds one landscape A4 page PER
 * shipment, with that shipment's own label printed TWICE side by side (two
 * copies to cut apart: one for the parcel, one to keep). A single-shipment
 * call (the normal ship-time case) returns a one-page PDF with two copies
 * of that one label.
 */
export async function buildDuplicatedLabelSheet(shipmentIds: string[]): Promise<Uint8Array> {
  if (shipmentIds.length === 0) {
    throw new Error("No Shiprocket shipment ids given");
  }

  const batchLabelUrl = await generateShiprocketLabelsBatch(shipmentIds);
  if (!batchLabelUrl) {
    throw new Error("Shiprocket did not return a label for the given shipment(s)");
  }

  const res = await fetch(batchLabelUrl);
  if (!res.ok) throw new Error(`Could not fetch the generated label PDF: ${res.status}`);
  const srcBytes = await res.arrayBuffer();
  const srcDoc = await PDFDocument.load(srcBytes);
  const pageCount = srcDoc.getPageCount();
  if (pageCount === 0) throw new Error("The generated label PDF had no pages");

  const outDoc = await PDFDocument.create();
  const embeddedPages = await outDoc.embedPdf(srcDoc, Array.from({ length: pageCount }, (_, i) => i));
  for (const embedded of embeddedPages) {
    drawDuplicatedPage(outDoc, embedded);
  }

  return outDoc.save();
}

/** Builds and uploads a single shipment's duplicated (2-copy) label sheet, returning its public URL — for attaching to the ship-time warehouse email. */
export async function buildAndUploadDuplicatedLabel(shipmentId: string, orderId: string): Promise<string | null> {
  try {
    const bytes = await buildDuplicatedLabelSheet([shipmentId]);
    const supabase = getSupabaseServerClient();
    const path = `labels/${orderId}-${Date.now()}.pdf`;
    const { error } = await supabase.storage
      .from("ad-creatives")
      .upload(path, Buffer.from(bytes), { contentType: "application/pdf", upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from("ad-creatives").getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.error("Failed to build/upload duplicated label sheet", orderId, err);
    return null;
  }
}
