import { previewAdsReportHtml } from "@/lib/performance-manager";

export const maxDuration = 120;

export async function GET() {
  try {
    const html = await previewAdsReportHtml();
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (err) {
    return new Response(err instanceof Error ? err.message : "Preview failed", { status: 500 });
  }
}
