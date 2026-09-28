import { redirect } from "next/navigation";

/**
 * /shop is linked from emails, ads and bios but the product grid lives on the
 * homepage — send people straight to it, keeping ?coupon= / UTM params so the
 * code auto-applies and the visit stays attributed.
 */
export default async function ShopPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string") qs.set(k, v);
  }
  const query = qs.toString();
  redirect(`/${query ? `?${query}` : ""}#shop`);
}
