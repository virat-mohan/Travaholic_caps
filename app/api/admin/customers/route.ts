import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getSetting } from "@/lib/settings";

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    const milesPerCapSetting = await getSetting("MILES_PER_CAP");
    const milesPerCap = milesPerCapSetting ? Number(milesPerCapSetting) : 100;

    const { data: orders, error } = await supabase
      .from("orders")
      .select("id, customer_name, customer_phone, customer_email, total, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const orderIds = (orders ?? []).map((o) => o.id);
    const { data: items } = orderIds.length
      ? await supabase.from("order_items").select("order_id, quantity").in("order_id", orderIds)
      : { data: [] };

    const capsByOrder = new Map<string, number>();
    for (const item of items ?? []) {
      capsByOrder.set(item.order_id, (capsByOrder.get(item.order_id) ?? 0) + item.quantity);
    }

    type CustomerRow = {
      phone: string;
      name: string;
      email: string;
      orderCount: number;
      capsBought: number;
      totalSpent: number;
      lastOrderAt: string;
      miles: number;
    };
    const byPhone = new Map<string, CustomerRow>();

    for (const order of orders ?? []) {
      const key = order.customer_phone || order.customer_email;
      const caps = capsByOrder.get(order.id) ?? 0;
      const existing = byPhone.get(key);
      if (existing) {
        existing.orderCount += 1;
        existing.capsBought += caps;
        existing.totalSpent += order.total ?? 0;
        if (order.created_at > existing.lastOrderAt) existing.lastOrderAt = order.created_at;
      } else {
        byPhone.set(key, {
          phone: order.customer_phone,
          name: order.customer_name,
          email: order.customer_email,
          orderCount: 1,
          capsBought: caps,
          totalSpent: order.total ?? 0,
          lastOrderAt: order.created_at,
          miles: 0,
        });
      }
    }

    const customers = [...byPhone.values()]
      .map((c) => ({ ...c, miles: c.capsBought * milesPerCap }))
      .sort((a, b) => b.totalSpent - a.totalSpent);

    return NextResponse.json({ customers, milesPerCap });
  } catch (err) {
    console.error("Failed to load customers", err);
    return NextResponse.json({ customers: [], milesPerCap: 100 }, { status: 500 });
  }
}
