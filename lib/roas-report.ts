import { getSupabaseServerClient } from "@/lib/supabase";
import { getAccountInsights } from "@/lib/meta-insights";

export type WeeklyReport = {
  weekStart: string;
  weekEnd: string;
  adSpend: number;
  clicks: number;
  impressions: number;
  pageViews: number;
  addToCarts: number;
  checkoutsStarted: number;
  ordersCount: number;
  revenue: number;
  abandonedCarts: number;
  roas: number | null;
};

/** Generates and stores a report for the 7-day window ending `weekEnd` (defaults to now). */
export async function generateWeeklyReport(weekEnd: Date = new Date()): Promise<WeeklyReport> {
  const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sinceISO = weekStart.toISOString();
  const untilISO = weekEnd.toISOString();

  const supabase = getSupabaseServerClient();

  const [{ data: events }, { data: orders }, { data: abandoned }, insights] = await Promise.all([
    supabase
      .from("tracking_events")
      .select("event_name")
      .gte("created_at", sinceISO)
      .lt("created_at", untilISO),
    supabase.from("orders").select("total").gte("created_at", sinceISO).lt("created_at", untilISO),
    supabase
      .from("cart_sessions")
      .select("id")
      .eq("status", "abandoned")
      .gte("last_activity_at", sinceISO)
      .lt("last_activity_at", untilISO),
    getAccountInsights(sinceISO.slice(0, 10), untilISO.slice(0, 10)),
  ]);

  const countEvent = (name: string) => (events ?? []).filter((e) => e.event_name === name).length;
  const revenue = (orders ?? []).reduce((sum, o) => sum + (o.total ?? 0), 0);
  const roas = insights.spend > 0 ? Number((revenue / insights.spend).toFixed(2)) : null;

  const report: WeeklyReport = {
    weekStart: weekStart.toISOString().slice(0, 10),
    weekEnd: weekEnd.toISOString().slice(0, 10),
    adSpend: insights.spend,
    clicks: insights.clicks,
    impressions: insights.impressions,
    pageViews: countEvent("PageView"),
    addToCarts: countEvent("AddToCart"),
    checkoutsStarted: countEvent("InitiateCheckout"),
    ordersCount: orders?.length ?? 0,
    revenue,
    abandonedCarts: abandoned?.length ?? 0,
    roas,
  };

  await supabase.from("weekly_reports").insert({
    week_start: report.weekStart,
    week_end: report.weekEnd,
    ad_spend: report.adSpend,
    clicks: report.clicks,
    impressions: report.impressions,
    page_views: report.pageViews,
    add_to_carts: report.addToCarts,
    checkouts_started: report.checkoutsStarted,
    orders_count: report.ordersCount,
    revenue: report.revenue,
    abandoned_carts: report.abandonedCarts,
    roas: report.roas,
  });

  return report;
}
