import { NextResponse } from "next/server";
import { getCurrentCustomer } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getRedeemableAmount } from "@/lib/loyalty";
import { getOrCreateReferralCode } from "@/lib/referrals";

export async function GET() {
  const customer = await getCurrentCustomer();
  if (!customer) return NextResponse.json({ customer: null });

  try {
    const supabase = getSupabaseServerClient();
    const [{ data: addresses }, { data: orders }, loyalty, referralCode, { count: referralCount }] =
      await Promise.all([
        supabase
          .from("customer_addresses")
          .select("*")
          .eq("customer_id", customer.id)
          .order("is_default", { ascending: false }),
        supabase
          .from("orders")
          .select("id, created_at, total, status")
          .eq("customer_id", customer.id)
          .order("created_at", { ascending: false })
          .limit(20),
        getRedeemableAmount(customer.id),
        getOrCreateReferralCode(customer.id),
        supabase
          .from("referrals")
          .select("id", { count: "exact", head: true })
          .eq("referrer_customer_id", customer.id),
      ]);

    return NextResponse.json({
      customer,
      addresses: addresses ?? [],
      orders: orders ?? [],
      loyalty,
      referralCode,
      referralCount: referralCount ?? 0,
    });
  } catch (err) {
    console.error("Failed to load account", err);
    return NextResponse.json({ customer, addresses: [], orders: [], loyalty: null });
  }
}
