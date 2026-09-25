// Email-safe HTML (tables + inline styles only — Gmail/Outlook strip
// <style> blocks and flex/grid) in the viratmohan.com palette.
const C = {
  paper: "#f4ead4",
  card: "#fbf6ea",
  ink: "#1a1410",
  dim: "#5a4c3c",
  line: "#e2d6bd",
  terracotta: "#D9714B",
  cobalt: "#3e6fa6",
  bronze: "#9c7a4a",
  good: "#3d7a4f",
  bad: "#b8412c",
};
const DISPLAY = "Anton, 'Arial Narrow', Impact, sans-serif";
const BODY = "Inter, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

export type ReportAdSet = {
  name: string;
  yesterday: { spend: number; purchases: number; roas: number | null };
  week: { spend: number; purchases: number; value: number; clicks: number; addToCarts: number; roas: number | null; activeDays: number };
};

export type ReportAction = { what: string; when: string; owner: "System" | "You" };

export type AdsReport = {
  date: string; // YYYY-MM-DD (the day being reported)
  isWeekly: boolean;
  targetRoas: number;
  capRupees: number;
  halted: boolean;
  adSets: ReportAdSet[];
  totals: { spend: number; purchases: number; value: number; roas: number | null; mer: number | null; siteRevenue: number; siteOrders: number; cpa: number | null; targetCpa: number };
  insights: string[];
  doneToday: string[];
  upcoming: ReportAction[];
  otherCampaigns: { name: string; spend7: number; purchases7: number; roas7: number | null }[];
};

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const x = (n: number | null) => (n === null ? "—" : `${n.toFixed(2)}x`);

function prettyDate(iso: string) {
  return new Date(`${iso}T12:00:00+05:30`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

function statusLine(r: AdsReport) {
  if (r.halted) return { label: "HALTED", color: C.bad, text: "The managed campaign is paused: real MER and Meta ROAS were both under target over 7 days. It relaunches with the next queued test on the next run." };
  if (r.totals.spend < 2000) return { label: "LEARNING", color: C.cobalt, text: `Still in Meta's learning phase (${inr(r.totals.spend)} spent so far). No verdicts yet. A day or two without orders is normal at this spend.` };
  const roas = r.totals.roas ?? 0;
  if (roas >= r.targetRoas) return { label: "ON TARGET", color: C.good, text: `7-day ROAS ${x(r.totals.roas)} against a ${r.targetRoas}x target.` };
  if (roas >= r.targetRoas * 0.5) return { label: "BELOW TARGET", color: C.terracotta, text: `7-day ROAS ${x(r.totals.roas)} against a ${r.targetRoas}x target. Weak ad sets are throttled and creative is being refreshed.` };
  return { label: "OFF TARGET", color: C.bad, text: `7-day ROAS ${x(r.totals.roas)} against a ${r.targetRoas}x target. Ad sets under 2x get paused once they pass ₹2,000 spend.` };
}

function section(title: string, inner: string) {
  return `
  <tr><td style="padding:28px 32px 0">
    <div style="font-family:${DISPLAY};font-size:22px;letter-spacing:1px;text-transform:uppercase;color:${C.ink};margin:0 0 12px">${esc(title)}</div>
    ${inner}
  </td></tr>`;
}

function stat(label: string, value: string, color = C.ink) {
  return `<td style="padding:12px 14px;background:${C.card};border:1px solid ${C.line};vertical-align:top" width="25%">
    <div style="font-family:${DISPLAY};font-size:24px;color:${color};line-height:1.1">${esc(value)}</div>
    <div style="font-family:${BODY};font-size:12px;color:${C.dim};margin-top:4px">${esc(label)}</div>
  </td>`;
}

export function renderAdsReportHtml(r: AdsReport) {
  const s = statusLine(r);
  const roasColor = r.totals.roas === null ? C.ink : r.totals.roas >= r.targetRoas ? C.good : C.bad;

  const rows = r.adSets
    .map(
      (a) => `<tr>
      <td style="padding:10px 8px;border-top:1px solid ${C.line};font-family:${BODY};font-size:13px;color:${C.ink}">${esc(a.name)}</td>
      <td style="padding:10px 8px;border-top:1px solid ${C.line};font-family:${BODY};font-size:13px;color:${C.ink};white-space:nowrap">${inr(a.yesterday.spend)} · ${a.yesterday.purchases}</td>
      <td style="padding:10px 8px;border-top:1px solid ${C.line};font-family:${BODY};font-size:13px;color:${C.ink};white-space:nowrap">${inr(a.week.spend)}</td>
      <td style="padding:10px 8px;border-top:1px solid ${C.line};font-family:${BODY};font-size:13px;color:${C.ink};white-space:nowrap">${a.week.clicks} → ${a.week.addToCarts} → ${a.week.purchases}</td>
      <td style="padding:10px 8px;border-top:1px solid ${C.line};font-family:${BODY};font-size:13px;font-weight:700;color:${a.week.roas !== null && a.week.roas >= r.targetRoas ? C.good : a.week.spend >= 100 ? C.bad : C.dim};white-space:nowrap">${x(a.week.roas)}</td>
    </tr>`
    )
    .join("");

  const table = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
    <tr>
      ${["Ad set", "Yesterday (spend · orders)", "7-day spend", "Clicks → carts → orders", "7-day ROAS"]
        .map((h) => `<td style="padding:0 8px 8px;font-family:${BODY};font-size:10px;letter-spacing:1px;text-transform:uppercase;color:${C.bronze}">${h}</td>`)
        .join("")}
    </tr>
    ${rows || `<tr><td colspan="5" style="padding:12px 8px;font-family:${BODY};font-size:13px;color:${C.dim}">No managed spend yet.</td></tr>`}
  </table>`;

  const bullet = (t: string, color = C.terracotta) =>
    `<tr><td style="padding:6px 0;vertical-align:top;width:18px;font-family:${BODY};font-size:14px;color:${color}">■</td><td style="padding:6px 0;font-family:${BODY};font-size:14px;line-height:1.5;color:${C.ink}">${esc(t)}</td></tr>`;

  const insights = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${r.insights.map((t) => bullet(t, C.cobalt)).join("")}</table>`;

  const done = r.doneToday.length
    ? `<div style="font-family:${BODY};font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${C.bronze};margin:0 0 4px">Done today</div>
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${r.doneToday.map((t) => bullet(t, C.good)).join("")}</table>`
    : `<div style="font-family:${BODY};font-size:14px;color:${C.dim};margin:0 0 8px">No changes were needed today, so nothing was changed. That protects the learning phase.</div>`;

  const upcoming = `<div style="font-family:${BODY};font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${C.bronze};margin:16px 0 6px">Coming up</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
      ${r.upcoming
        .map(
          (a) => `<tr>
        <td style="padding:9px 8px 9px 0;border-top:1px solid ${C.line};font-family:${DISPLAY};font-size:14px;color:${C.ink};white-space:nowrap;vertical-align:top;width:92px">${esc(a.when)}</td>
        <td style="padding:9px 8px;border-top:1px solid ${C.line};font-family:${BODY};font-size:14px;line-height:1.45;color:${C.ink}">${esc(a.what)}</td>
        <td style="padding:9px 0 9px 8px;border-top:1px solid ${C.line};font-family:${BODY};font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${a.owner === "You" ? C.terracotta : C.cobalt};white-space:nowrap;vertical-align:top;text-align:right">${a.owner}</td>
      </tr>`
        )
        .join("")}
    </table>`;

  const others = r.otherCampaigns.length
    ? section(
        "Other campaigns",
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${r.otherCampaigns
          .map((o) => bullet(`${o.name}: ${inr(o.spend7)} over 7 days, ${o.purchases7} orders, ${x(o.roas7)}. Not managed by this system.`, C.bronze))
          .join("")}</table>`
      )
    : "";

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;700&display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background:${C.paper}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:${C.paper}">

  <tr><td style="padding:8px 32px 0">
    <div style="font-family:${BODY};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${C.bronze}">Travaholic · Meta ads · ${esc(prettyDate(r.date))}</div>
    <div style="font-family:${DISPLAY};font-size:40px;line-height:1.05;text-transform:uppercase;color:${C.ink};margin:8px 0 0">${r.isWeekly ? "Weekly ads review" : "Daily ads report"}</div>
  </td></tr>

  ${section(
    "Summary",
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:14px 16px;background:${C.ink};">
      <span style="font-family:${DISPLAY};font-size:14px;letter-spacing:1px;color:${C.paper};background:${s.color};padding:3px 8px">${s.label}</span>
      <div style="font-family:${BODY};font-size:15px;line-height:1.5;color:${C.paper};margin-top:10px">${esc(s.text)}</div>
    </td></tr></table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="6" style="margin-top:10px"><tr>
      ${stat("7-day spend", inr(r.totals.spend))}
      ${stat("Orders (Meta)", String(r.totals.purchases))}
      ${stat(`ROAS · target ${r.targetRoas}x`, x(r.totals.roas), roasColor)}
      ${stat(`Cost/order · target ${inr(r.totals.targetCpa)}`, r.totals.cpa === null ? "—" : inr(r.totals.cpa), r.totals.cpa !== null && r.totals.cpa <= r.totals.targetCpa ? C.good : C.ink)}
    </tr></table>
    <div style="font-family:${BODY};font-size:12px;color:${C.dim};margin-top:6px">Real MER (all site revenue ÷ ad spend): <b style="color:${C.ink}">${x(r.totals.mer)}</b> · ${inr(r.totals.siteRevenue)} from ${r.totals.siteOrders} site orders · daily budget ${inr(r.capRupees)} cap</div>`
  )}

  ${section("Results", table)}
  ${section("Insights", insights)}
  ${section("Actions", done + upcoming)}
  ${others}

  <tr><td style="padding:36px 32px 8px">
    <div style="border-top:2px solid ${C.ink};padding-top:14px;font-family:${BODY};font-size:12px;line-height:1.6;color:${C.dim}">
      Made by <b style="color:${C.ink}">DevShop™ Retail OS™</b> · For further information: <b style="color:${C.ink}">Virat Mohan</b> · viratmohan@gmail.com · +91 99992 77240 · <a href="https://viratmohan.com" style="color:${C.terracotta}">viratmohan.com</a>
    </div>
  </td></tr>

</table></td></tr></table></body></html>`;
}
