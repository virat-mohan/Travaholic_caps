import { PDFDocument } from "pdf-lib";
import { generateShiprocketLabelsBatch } from "@/lib/shiprocket";

// Landscape A4.
const A4_WIDTH = 841.89;
const A4_HEIGHT = 595.28;

/**
 * Fetches all the selected orders' Shiprocket shipping labels in ONE batch
 * call (see generateShiprocketLabelsBatch — that's the only way to
 * guarantee distinct labels; calling per-order separately can return the
 * same cached label_url for each), then lays two per landscape A4 page —
 * left half and right half, each scaled to fit and centered — so a
 * warehouse can print a full day's labels on regular A4 paper instead of
 * one label per sheet.
 */
export async function mergeLabelsToA4(
  orders: { id: string; shiprocket_shipment_id: string | null }[]
): Promise<Uint8Array> {
  const shipmentIds = orders.map((o) => o.shiprocket_shipment_id).filter((id): id is string => !!id);
  if (shipmentIds.length === 0) {
    throw new Error("None of the selected orders have a Shiprocket shipment yet");
  }

  const batchLabelUrl = await generateShiprocketLabelsBatch(shipmentIds);
  if (!batchLabelUrl) {
    throw new Error("Shiprocket did not return a label for the selected orders");
  }

  const res = await fetch(batchLabelUrl);
  if (!res.ok) throw new Error(`Could not fetch the generated label PDF: ${res.status}`);
  const srcBytes = await res.arrayBuffer();
  const srcDoc = await PDFDocument.load(srcBytes);
  const pageCount = srcDoc.getPageCount();
  if (pageCount === 0) throw new Error("The generated label PDF had no pages");

  const outDoc = await PDFDocument.create();
  const embeddedPages = await outDoc.embedPdf(srcDoc, Array.from({ length: pageCount }, (_, i) => i));
  const halfWidth = A4_WIDTH / 2;

  for (let i = 0; i < embeddedPages.length; i += 2) {
    const pair = embeddedPages.slice(i, i + 2);
    const page = outDoc.addPage([A4_WIDTH, A4_HEIGHT]);

    for (let slot = 0; slot < pair.length; slot++) {
      const embedded = pair[slot];

      // Scale the label to fit within its half of the page (with a small
      // margin), preserving aspect ratio, then center it in that half.
      const margin = 24;
      const maxWidth = halfWidth - margin * 2;
      const maxHeight = A4_HEIGHT - margin * 2;
      const scale = Math.min(maxWidth / embedded.width, maxHeight / embedded.height);
      const drawWidth = embedded.width * scale;
      const drawHeight = embedded.height * scale;

      const slotLeft = slot === 0 ? 0 : halfWidth;
      const x = slotLeft + (halfWidth - drawWidth) / 2;
      const y = (A4_HEIGHT - drawHeight) / 2;

      page.drawPage(embedded, { x, y, width: drawWidth, height: drawHeight });
    }

    // A faint cut line between the two halves.
    page.drawLine({
      start: { x: halfWidth, y: 0 },
      end: { x: halfWidth, y: A4_HEIGHT },
      thickness: 0.5,
      dashArray: [4, 4],
      opacity: 0.4,
    });
  }

  return outDoc.save();
}
