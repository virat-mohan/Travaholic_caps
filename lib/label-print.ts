import { PDFDocument } from "pdf-lib";
import { getSupabaseServerClient } from "@/lib/supabase";
import { generateShiprocketLabel } from "@/lib/shiprocket";

/** Order's cached label URL, regenerating it from Shiprocket if it was never stored (an order shipped before shiprocket_label_url existed). */
async function getOrRegenerateLabelUrl(order: { id: string; shiprocket_shipment_id: string | null; shiprocket_label_url: string | null }) {
  if (order.shiprocket_label_url) return order.shiprocket_label_url;
  if (!order.shiprocket_shipment_id) return null;

  const labelUrl = await generateShiprocketLabel(order.shiprocket_shipment_id);
  if (labelUrl) {
    const supabase = getSupabaseServerClient();
    await supabase.from("orders").update({ shiprocket_label_url: labelUrl }).eq("id", order.id);
  }
  return labelUrl;
}

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

/**
 * Fetches each order's Shiprocket shipping label (a single-label PDF,
 * typically sized for a 4x6" thermal printer) and lays two per A4 page —
 * one in the top half, one in the bottom half, each scaled to fit and
 * centered — so a warehouse can print a full day's labels on regular A4
 * paper instead of one label per sheet.
 */
export async function mergeLabelsToA4(
  orders: { id: string; shiprocket_shipment_id: string | null; shiprocket_label_url: string | null }[]
): Promise<Uint8Array> {
  const labelUrls: string[] = [];
  for (const order of orders) {
    const url = await getOrRegenerateLabelUrl(order);
    if (url) labelUrls.push(url);
  }
  if (labelUrls.length === 0) {
    throw new Error("None of the selected orders have a generated label yet");
  }

  const outDoc = await PDFDocument.create();
  const halfHeight = A4_HEIGHT / 2;

  for (let i = 0; i < labelUrls.length; i += 2) {
    const pair = labelUrls.slice(i, i + 2);
    const page = outDoc.addPage([A4_WIDTH, A4_HEIGHT]);

    for (let slot = 0; slot < pair.length; slot++) {
      const res = await fetch(pair[slot]);
      if (!res.ok) continue;
      const bytes = await res.arrayBuffer();
      const srcDoc = await PDFDocument.load(bytes);
      const [embedded] = await outDoc.embedPdf(srcDoc, [0]);

      // Scale the label to fit within its half of the page (with a small
      // margin), preserving aspect ratio, then center it in that half.
      const margin = 24;
      const maxWidth = A4_WIDTH - margin * 2;
      const maxHeight = halfHeight - margin * 2;
      const scale = Math.min(maxWidth / embedded.width, maxHeight / embedded.height);
      const drawWidth = embedded.width * scale;
      const drawHeight = embedded.height * scale;

      const slotBottom = slot === 0 ? halfHeight : 0;
      const x = (A4_WIDTH - drawWidth) / 2;
      const y = slotBottom + (halfHeight - drawHeight) / 2;

      page.drawPage(embedded, { x, y, width: drawWidth, height: drawHeight });
    }

    // A faint cut line between the two halves.
    page.drawLine({
      start: { x: 0, y: halfHeight },
      end: { x: A4_WIDTH, y: halfHeight },
      thickness: 0.5,
      dashArray: [4, 4],
      opacity: 0.4,
    });
  }

  return outDoc.save();
}
