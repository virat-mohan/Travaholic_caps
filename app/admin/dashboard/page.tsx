import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase";
import { chapters } from "@/lib/chapters";
import { InventoryRow } from "@/components/admin/InventoryRow";
import { OrderStatusCell } from "@/components/admin/OrderStatusCell";
import { DiscountRulesEditor } from "@/components/admin/DiscountRulesEditor";

// This page reads live, frequently-changing data (orders, stock) and needs
// Supabase env vars — never prerender it at build time.
export const dynamic = "force-dynamic";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function AdminDashboardPage() {
  let orders: { id: string; created_at: string; customer_name: string; customer_phone: string; total: number; subtotal: number; discount_amount: number; status: string; shipment_status: string | null; refund_status: string | null; is_gift: boolean; gift_note: string | null }[] = [];
  let inventory: { chapter_slug: string; stock_on_hand: number }[] = [];
  let rules: { id: string; name: string; buy_quantity: number; discount_percent: number; active: boolean }[] = [];
  let configError = false;

  try {
    const supabase = getSupabaseServerClient();
    const [ordersRes, inventoryRes, rulesRes] = await Promise.all([
      supabase
        .from("orders")
        .select("id, created_at, customer_name, customer_phone, total, subtotal, discount_amount, status, shipment_status, refund_status, is_gift, gift_note")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("inventory").select("chapter_slug, stock_on_hand").order("chapter_slug"),
      supabase.from("discount_rules").select("id, name, buy_quantity, discount_percent, active"),
    ]);
    orders = ordersRes.data ?? [];
    inventory = inventoryRes.data ?? [];
    rules = rulesRes.data ?? [];
  } catch {
    configError = true;
  }

  const inventoryBySlug = new Map(inventory.map((i) => [i.chapter_slug, i.stock_on_hand]));

  if (configError) {
    return (
      <main className="mx-auto w-full max-w-[1400px] px-6 pt-28 pb-24 md:px-12">
        <h1 className="font-display text-heading-l uppercase text-ink">Admin Dashboard</h1>
        <p className="mt-4 text-body-s text-paint-orange">
          SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY aren&apos;t set in this environment yet — add
          them in Vercel under Project Settings → Environment Variables, then redeploy.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1400px] px-6 pt-28 pb-24 md:px-12">
      <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">
        Internal — not linked in navigation
      </p>
      <h1 className="mt-2 font-display text-heading-l uppercase text-ink">Admin Dashboard</h1>

      <section className="mt-12">
        <h2 className="font-display text-heading-s uppercase text-ink">
          Recent Orders ({orders?.length ?? 0})
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead>
              <tr className="border-b border-divider text-caption uppercase tracking-[0.05em] text-secondary-text">
                <th className="py-2 pr-4">When</th>
                <th className="py-2 pr-4">Customer</th>
                <th className="py-2 pr-4">Phone</th>
                <th className="py-2 pr-4">Subtotal</th>
                <th className="py-2 pr-4">Discount</th>
                <th className="py-2 pr-4">Total</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Shipment</th>
                <th className="py-2 pr-4">Refund</th>
                <th className="py-2 pr-4">Gift</th>
              </tr>
            </thead>
            <tbody>
              {(orders ?? []).map((o) => (
                <tr key={o.id} className="border-b border-divider">
                  <td className="py-3 text-caption text-secondary-text">
                    {formatDate(o.created_at)}
                  </td>
                  <td className="py-3 font-sans text-body-s text-ink">{o.customer_name}</td>
                  <td className="py-3 text-caption text-secondary-text">{o.customer_phone}</td>
                  <td className="py-3 text-caption text-secondary-text">
                    ₹{o.subtotal?.toLocaleString("en-IN")}
                  </td>
                  <td className="py-3 text-caption text-tan-gold">
                    {o.discount_amount ? `−₹${o.discount_amount.toLocaleString("en-IN")}` : "—"}
                  </td>
                  <td className="py-3 font-sans text-body-s text-ink">
                    ₹{o.total?.toLocaleString("en-IN")}
                  </td>
                  <td className="py-3">
                    <OrderStatusCell orderId={o.id} field="status" value={o.status} />
                  </td>
                  <td className="py-3">
                    <OrderStatusCell
                      orderId={o.id}
                      field="shipmentStatus"
                      value={o.shipment_status ?? "not_shipped"}
                    />
                  </td>
                  <td className="py-3">
                    <OrderStatusCell
                      orderId={o.id}
                      field="refundStatus"
                      value={o.refund_status ?? "none"}
                    />
                  </td>
                  <td className="py-3 text-caption text-secondary-text">
                    {o.is_gift ? o.gift_note || "Yes" : "—"}
                  </td>
                </tr>
              ))}
              {(!orders || orders.length === 0) && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-body-s text-secondary-text">
                    No orders yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="font-display text-heading-s uppercase text-ink">Inventory</h2>
        <table className="mt-4 w-full max-w-xl text-left">
          <thead>
            <tr className="border-b border-divider text-caption uppercase tracking-[0.05em] text-secondary-text">
              <th className="py-2 pr-4">Chapter</th>
              <th className="py-2 pr-4">Stock On Hand</th>
              <th className="py-2 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {chapters.map((c) => (
              <InventoryRow
                key={c.slug}
                chapterSlug={c.slug}
                chapterName={c.name}
                stockOnHand={inventoryBySlug.get(c.slug) ?? 0}
              />
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-16">
        <h2 className="font-display text-heading-s uppercase text-ink">Discount Rules</h2>
        <DiscountRulesEditor initialRules={rules ?? []} />
      </section>

      <section className="mt-16 border-t border-divider pt-8">
        <h2 className="font-display text-heading-s uppercase text-ink">More</h2>
        <div className="mt-4 flex flex-wrap gap-4">
          <Link href="/admin/edit-chapter" className="text-body-s text-ink underline">
            Edit Chapters &amp; Hero Images
          </Link>
          <Link href="/admin/settings" className="text-body-s text-ink underline">
            API Keys &amp; Settings
          </Link>
          <Link href="/admin/journal-drafts" className="text-body-s text-ink underline">
            Journal Draft Generator
          </Link>
        </div>
      </section>
    </main>
  );
}
