import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

function currentMonthKey() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" });
}

function monthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function shiftMonth(monthKey: string, delta: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function money(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export default async function AdminPnlPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const monthKey = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentMonthKey();
  const [year, month] = monthKey.split("-").map(Number);
  const rangeStart = new Date(Date.UTC(year, month - 1, 1)).toISOString();
  const rangeEnd = new Date(Date.UTC(year, month, 1)).toISOString();

  let configError = false;
  let grossSales = 0;
  let discountsGiven = 0;
  let refunds = 0;
  let shippingCollected = 0;
  let unitsSold = 0;
  let expensesByCategory: { category: string; amount: number }[] = [];
  let expensesTotal = 0;
  let costPerCap = 250;

  try {
    const supabase = getSupabaseServerClient();
    const costSetting = await getSetting("COGS_PER_CAP_RUPEES");
    if (costSetting) costPerCap = Number(costSetting);

    const { data: orders } = await supabase
      .from("orders")
      .select(
        "id, subtotal, discount_amount, referral_discount_amount, loyalty_discount_amount, coupon_discount_amount, shipping_charge, refunded_amount, status"
      )
      .gte("created_at", rangeStart)
      .lt("created_at", rangeEnd)
      .neq("status", "cancelled");

    for (const o of orders ?? []) {
      grossSales += o.subtotal ?? 0;
      discountsGiven +=
        (o.discount_amount ?? 0) +
        (o.referral_discount_amount ?? 0) +
        (o.loyalty_discount_amount ?? 0) +
        (o.coupon_discount_amount ?? 0);
      refunds += o.refunded_amount ?? 0;
      shippingCollected += o.shipping_charge ?? 0;
    }

    const orderIds = (orders ?? []).map((o) => o.id);
    if (orderIds.length > 0) {
      const { data: items } = await supabase
        .from("order_items")
        .select("quantity, order_id")
        .in("order_id", orderIds);
      unitsSold = (items ?? []).reduce((sum, i) => sum + (i.quantity ?? 0), 0);
    }

    const { data: expenses } = await supabase
      .from("expenses")
      .select("category, amount")
      .gte("expense_date", rangeStart.slice(0, 10))
      .lt("expense_date", rangeEnd.slice(0, 10));

    const byCategory = new Map<string, number>();
    for (const e of expenses ?? []) {
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + (e.amount ?? 0));
    }
    expensesByCategory = Array.from(byCategory.entries()).map(([category, amount]) => ({ category, amount }));
    expensesTotal = expensesByCategory.reduce((sum, e) => sum + e.amount, 0);
  } catch {
    configError = true;
  }

  const netSales = grossSales - discountsGiven - refunds;
  const cogs = unitsSold * costPerCap;
  const grossProfit = netSales - cogs;
  const netProfit = grossProfit - expensesTotal;

  if (configError) {
    return (
      <main className="mx-auto w-full max-w-[900px] px-6 pt-28 pb-24 md:px-12">
        <h1 className="font-display text-heading-l uppercase text-ink">P&amp;L</h1>
        <p className="mt-4 text-body-s text-paint-orange">
          SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY aren&apos;t set in this environment yet.
        </p>
      </main>
    );
  }

  const Row = ({
    label,
    value,
    bold,
    indent,
  }: {
    label: string;
    value: number | string;
    bold?: boolean;
    indent?: boolean;
  }) => (
    <div
      className={`flex items-center justify-between border-b border-divider py-2.5 ${indent ? "pl-6" : ""}`}
    >
      <span className={`font-sans text-body-s ${bold ? "font-bold text-ink" : "text-secondary-text"}`}>
        {label}
      </span>
      <span className={`font-sans text-body-s ${bold ? "font-bold text-ink" : "text-ink"}`}>
        {typeof value === "number" ? money(value) : value}
      </span>
    </div>
  );

  return (
    <main className="mx-auto w-full max-w-[900px] px-6 pt-28 pb-24 md:px-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="mt-2 font-display text-heading-l uppercase text-ink">P&amp;L</h1>
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/pnl?month=${shiftMonth(monthKey, -1)}`}
            className="border border-divider px-3 py-1.5 text-caption uppercase tracking-[0.05em] text-ink hover:border-ink"
          >
            ← Prev
          </Link>
          <span className="font-sans text-body-s text-ink">{monthLabel(monthKey)}</span>
          <Link
            href={`/admin/pnl?month=${shiftMonth(monthKey, 1)}`}
            className="border border-divider px-3 py-1.5 text-caption uppercase tracking-[0.05em] text-ink hover:border-ink"
          >
            Next →
          </Link>
        </div>
      </div>
      <p className="mt-2 max-w-lg text-body-s text-secondary-text">
        Live — recalculated from real orders, refunds, and logged expenses for the selected month.
        Cost per cap: {money(costPerCap)} (edit in Settings → Finance).
      </p>

      <div className="mt-10">
        <Row label="Gross Sales" value={grossSales} />
        <Row label="Discounts, Referrals, Miles & Coupons" value={-discountsGiven} indent />
        <Row label="Refunds" value={-refunds} indent />
        <Row label="Net Sales" value={netSales} bold />

        <div className="mt-6" />
        <Row label={`Cost of Goods (${unitsSold} units × ${money(costPerCap)})`} value={-cogs} indent />
        <Row label="Gross Profit" value={grossProfit} bold />

        <div className="mt-6" />
        {expensesByCategory.length === 0 ? (
          <Row label="Operating Expenses (none logged)" value={0} indent />
        ) : (
          expensesByCategory.map((e) => (
            <Row key={e.category} label={e.category} value={-e.amount} indent />
          ))
        )}
        <Row label="Total Operating Expenses" value={-expensesTotal} indent />

        <div className="mt-6" />
        <Row
          label="Net Profit"
          value={netProfit}
          bold
        />
        <p className="mt-2 text-caption text-secondary-text">
          Shipping collected from customers this month: {money(shippingCollected)} (informational —
          not netted above since actual courier cost isn&apos;t tracked yet; log it under Expenses
          if you want it reflected here).
        </p>
      </div>

      <div className="mt-10 flex gap-4">
        <Link href="/admin/expenses" className="text-caption text-secondary-text underline">
          Manage Expenses
        </Link>
        <Link href="/admin/coupons" className="text-caption text-secondary-text underline">
          Manage Coupons
        </Link>
      </div>
    </main>
  );
}
