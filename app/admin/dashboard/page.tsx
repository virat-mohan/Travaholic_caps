import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase";
import { chapters } from "@/lib/chapters";
import { InventoryRow } from "@/components/admin/InventoryRow";
import { OrderStatusCell } from "@/components/admin/OrderStatusCell";
import { ShipmentCell } from "@/components/admin/ShipmentCell";
import { RefundActions } from "@/components/admin/RefundActions";

// This page reads live, frequently-changing data (orders, stock) and needs
// Supabase env vars — never prerender it at build time.
export const dynamic = "force-dynamic";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function AdminDashboardPage() {
  let orders: {
    id: string;
    created_at: string;
    customer_name: string;
    customer_phone: string;
    total: number;
    subtotal: number;
    discount_amount: number;
    payment_type: string | null;
    balance_due: number | null;
    status: string;
    shipment_status: string | null;
    refund_status: string | null;
    is_gift: boolean;
    gift_note: string | null;
    shiprocket_order_id: string | null;
    shiprocket_shipment_id: string | null;
    shiprocket_awb_code: string | null;
    courier_name: string | null;
    razorpay_payment_id: string | null;
    refunded_amount: number | null;
    return_shipment_id: string | null;
  }[] = [];
  let inventory: { chapter_slug: string; stock_on_hand: number }[] = [];
  let configError = false;

  try {
    const supabase = getSupabaseServerClient();
    const [ordersRes, inventoryRes] = await Promise.all([
      supabase
        .from("orders")
        .select(
          "id, created_at, customer_name, customer_phone, total, subtotal, discount_amount, payment_type, balance_due, status, shipment_status, refund_status, is_gift, gift_note, shiprocket_order_id, shiprocket_shipment_id, shiprocket_awb_code, courier_name, razorpay_payment_id, refunded_amount, return_shipment_id"
        )
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("inventory").select("chapter_slug, stock_on_hand").order("chapter_slug"),
    ]);
    orders = ordersRes.data ?? [];
    inventory = inventoryRes.data ?? [];
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
        <div className="flex items-center justify-between">
          <h2 className="font-display text-heading-s uppercase text-ink">
            Recent Orders ({orders?.length ?? 0})
          </h2>
          <Link
            href="/admin/orders/new"
            className="border border-ink px-4 py-2 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink hover:bg-ink hover:text-cream"
          >
            + Add Manual Order
          </Link>
        </div>
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
                <th className="py-2 pr-4">Payment</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Shipment</th>
                <th className="py-2 pr-4">Shipping</th>
                <th className="py-2 pr-4">Refund</th>
                <th className="py-2 pr-4">Actions</th>
                <th className="py-2 pr-4">Invoice</th>
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
                  <td className="py-3 text-caption">
                    {o.payment_type === "cod_advance" ? (
                      <span className="font-bold text-paint-orange">
                        COD · ₹{o.balance_due?.toLocaleString("en-IN")} due
                      </span>
                    ) : (
                      <span className="text-secondary-text">Prepaid</span>
                    )}
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
                    <ShipmentCell
                      orderId={o.id}
                      shiprocketOrderId={o.shiprocket_order_id}
                      shipmentId={o.shiprocket_shipment_id}
                      awbCode={o.shiprocket_awb_code}
                      courierName={o.courier_name}
                    />
                  </td>
                  <td className="py-3">
                    <OrderStatusCell
                      orderId={o.id}
                      field="refundStatus"
                      value={o.refund_status ?? "none"}
                    />
                  </td>
                  <td className="py-3">
                    <RefundActions
                      orderId={o.id}
                      total={o.total}
                      refundedAmount={o.refunded_amount ?? 0}
                      hasRazorpayPayment={!!o.razorpay_payment_id}
                      returnShipmentId={o.return_shipment_id}
                      status={o.status}
                      shipmentStatus={o.shipment_status ?? "not_shipped"}
                    />
                  </td>
                  <td className="py-3">
                    <Link
                      href={`/invoice/${o.id}`}
                      target="_blank"
                      className="text-micro text-secondary-text underline"
                    >
                      View
                    </Link>
                  </td>
                  <td className="py-3 text-caption text-secondary-text">
                    {o.is_gift ? o.gift_note || "Yes" : "—"}
                  </td>
                </tr>
              ))}
              {(!orders || orders.length === 0) && (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-body-s text-secondary-text">
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

    </main>
  );
}
