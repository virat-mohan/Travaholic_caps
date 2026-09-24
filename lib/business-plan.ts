import { getSupabaseServerClient } from "@/lib/supabase";
import { getSetting } from "@/lib/settings";
import { getAllChapters } from "@/lib/chapters-dynamic";
import { isPostBarterEnabled } from "@/lib/post-barter";
import type { BusinessPlanDrivers, CategoryDriver, ShippingPolicy } from "@/lib/business-plan-calc";

export { computePlanFromDrivers, DRIVER_FIELDS } from "@/lib/business-plan-calc";
export type {
  BusinessPlanDrivers,
  MonthPlan,
  ComputedPlan,
  CategoryDriver,
  CityDriver,
  ShippingPolicy,
  FixedCostLine,
} from "@/lib/business-plan-calc";

// ============================================================
// Forward-looking, driver-based quarterly benchmark P&L — distinct from
// lib/pnl.ts (which reports what actually happened). This module lets
// Claude research the market and propose DRIVERS (not totals), which a
// human then edits; computePlanFromDrivers is the single place money is
// ever calculated from those drivers, called identically at generation
// time and every time a driver is edited, so the two can never drift.
//
// A future variance report (forecast vs. lib/pnl.ts actuals for the same
// months) is a natural extension of this table — quarter_start already
// keys a plan to real calendar months for exactly that purpose — but is
// not built yet.
// ============================================================

/** Deterministic setup a human chooses BEFORE generation — never researched, always passed straight through. */
export type PlanSetup = {
  targetCities: string[];
  shippingPolicy: ShippingPolicy;
};

// ---- Deterministic grounding (fetched BEFORE any model call) ----

/** Groups the real catalog by Story Series — the only real "categories" this store has. Ground truth, never guessed. */
async function fetchCategoryGroundTruth(): Promise<Omit<CategoryDriver, "shareOfOrdersPct" | "productCostPct">[]> {
  const chapters = await getAllChapters();
  const bySeries = new Map<string, { priceSum: number; count: number }>();
  for (const c of chapters) {
    const existing = bySeries.get(c.series);
    if (existing) {
      existing.count += 1;
      existing.priceSum += c.price;
    } else {
      bySeries.set(c.series, { priceSum: c.price, count: 1 });
    }
  }
  return Array.from(bySeries.entries()).map(([series, { priceSum, count }]) => {
    // Every Chapter is priced ~identically (flat ₹1,399 per the brand's
    // no-discount-gimmick pricing brief), but a few may genuinely differ —
    // averaging real per-Chapter prices within the series is real ground
    // truth, never a hardcoded flat number.
    const avgPrice = Math.round(priceSum / count);
    return {
      series,
      label: `${series} — ₹${avgPrice}`,
      priceRupees: avgPrice,
      skuCount: count,
    };
  });
}

/** Real trailing-90-day performance, if any — a live store's own history beats a researched benchmark. */
async function fetchActualBaseline() {
  const supabase = getSupabaseServerClient();
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: orders } = await supabase
    .from("orders")
    .select("subtotal, payment_type, is_post_barter, rto_processed_at, created_at")
    .gte("created_at", since)
    .neq("status", "cancelled");

  const rows = orders ?? [];
  if (rows.length < 10) {
    return { hasData: false as const, orderCount: rows.length };
  }

  const codRows = rows.filter((o) => o.payment_type === "cod_advance");
  const barterRows = rows.filter((o) => o.is_post_barter);
  const avgSubtotal = Math.round(rows.reduce((s, o) => s + (o.subtotal ?? 0), 0) / rows.length);
  const codShare = rows.length ? Math.round((codRows.length / rows.length) * 1000) / 10 : 0;
  const barterShare = rows.length ? Math.round((barterRows.length / rows.length) * 1000) / 10 : 0;
  const rtoOfCod = codRows.length
    ? Math.round((codRows.filter((o) => o.rto_processed_at).length / codRows.length) * 1000) / 10
    : 0;

  return {
    hasData: true as const,
    orderCount: rows.length,
    ordersPerMonth: Math.round((rows.length / 90) * 30),
    avgOrderValueRupees: avgSubtotal,
    codSharePctOfAllOrders: codShare,
    postBarterSharePct: barterShare,
    rtoRatePctOfCod: rtoOfCod,
  };
}

type ModelDrivers = {
  categories: { series: string; shareOfOrdersPct: number; productCostPct: number }[];
  cities: { name: string; monthlyOrders: [number, number, number]; cacRupeesPerOrder: number; rationale: string }[];
  packagingCostPerOrderRupees: number;
  adminTechPct: number;
  codSharePct: number;
  paymentGatewayFeePct: number;
  codHandlingFeePct: number;
  rtoRatePct: number;
  rtoCostPerOrderRupees: number;
  ndrCostPerOrderRupees: number;
  shippingCostPerOrderRupees: number;
  postBarterSharePct: number;
  fixedCostLines: { label: string; amountRupees: number }[];
  rationale: BusinessPlanDrivers["rationale"];
};

function extractDriversFromToolUse(content: { type: string; name?: string; input?: unknown }[]): ModelDrivers {
  const toolUse = content.find((b) => b.type === "tool_use" && b.name === "submit_business_plan_drivers");
  if (!toolUse) {
    throw new Error("Claude did not call submit_business_plan_drivers — no structured drivers returned");
  }
  return toolUse.input as ModelDrivers;
}

const SUBMIT_TOOL = {
  name: "submit_business_plan_drivers",
  description:
    "Submit the final set of benchmark P&L drivers for the next 3 months, each with a one-paragraph cited rationale. Call this exactly once, after any research, as your final action.",
  input_schema: {
    type: "object" as const,
    properties: {
      categories: {
        type: "array",
        description: "One entry for EVERY series listed in the prompt, no more, no fewer.",
        items: {
          type: "object",
          properties: {
            series: { type: "string", description: "Series name, exactly as listed in the prompt (e.g. \"The Essentials\")." },
            shareOfOrdersPct: { type: "number", description: "% of total orders this series makes up. All series together should sum to 100." },
            productCostPct: { type: "number", description: "Raw cap material/embroidery/patch cost as % of THIS series' price — design complexity differs by series even at the same retail price, so this can differ from other series." },
          },
          required: ["series", "shareOfOrdersPct", "productCostPct"],
        },
      },
      cities: {
        type: "array",
        description: "One entry for EVERY city listed in the prompt as a target city, no more, no fewer.",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            monthlyOrders: {
              type: "array",
              minItems: 3,
              maxItems: 3,
              items: { type: "number" },
              description: "Orders from this city for month 1, 2, 3 — a realistic ramp.",
            },
            cacRupeesPerOrder: { type: "number", description: "Blended paid customer acquisition cost per order, in rupees, specific to this city's competition/CPMs." },
            rationale: { type: "string" },
          },
          required: ["name", "monthlyOrders", "cacRupeesPerOrder", "rationale"],
        },
      },
      packagingCostPerOrderRupees: { type: "number" },
      adminTechPct: { type: "number" },
      codSharePct: { type: "number" },
      paymentGatewayFeePct: { type: "number" },
      codHandlingFeePct: { type: "number" },
      rtoRatePct: { type: "number" },
      rtoCostPerOrderRupees: { type: "number" },
      ndrCostPerOrderRupees: { type: "number" },
      shippingCostPerOrderRupees: { type: "number" },
      postBarterSharePct: { type: "number" },
      fixedCostLines: {
        type: "array",
        description:
          "Named monthly fixed costs — e.g. a performance marketing agency/freelancer retainer (distinct from the per-order CAC spend itself), tooling/SaaS, ops freelancers, a base 3PL/warehouse fee. Propose realistic named lines and amounts for an early-stage Indian D2C brand, don't just lump into one number.",
        items: {
          type: "object",
          properties: { label: { type: "string" }, amountRupees: { type: "number" } },
          required: ["label", "amountRupees"],
        },
      },
      rationale: {
        type: "object",
        properties: {
          categoryMix: { type: "string" },
          adminTech: { type: "string" },
          codShare: { type: "string" },
          paymentGatewayFee: { type: "string" },
          codHandlingFee: { type: "string" },
          rtoRate: { type: "string" },
          rtoCost: { type: "string" },
          ndrCost: { type: "string" },
          shippingCost: { type: "string" },
          packagingCost: { type: "string" },
          postBarter: { type: "string" },
          fixedCosts: { type: "string" },
        },
        required: [
          "categoryMix",
          "adminTech",
          "codShare",
          "paymentGatewayFee",
          "codHandlingFee",
          "rtoRate",
          "rtoCost",
          "ndrCost",
          "shippingCost",
          "packagingCost",
          "postBarter",
          "fixedCosts",
        ],
      },
    },
    required: [
      "categories",
      "cities",
      "packagingCostPerOrderRupees",
      "adminTechPct",
      "codSharePct",
      "paymentGatewayFeePct",
      "codHandlingFeePct",
      "rtoRatePct",
      "rtoCostPerOrderRupees",
      "ndrCostPerOrderRupees",
      "shippingCostPerOrderRupees",
      "postBarterSharePct",
      "fixedCostLines",
      "rationale",
    ],
  },
};

export async function generateBusinessPlanDrivers(quarterStart: string, setup: PlanSetup): Promise<BusinessPlanDrivers> {
  const apiKey = await getSetting("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set — add it in /admin/settings first");
  }
  if (setup.targetCities.length === 0) {
    throw new Error("Add at least one target city before generating");
  }

  // 1. Deterministic grounding — fetched before any model call, never guessed at.
  const [categoryTruth, baseline, postBarterEnabled] = await Promise.all([
    fetchCategoryGroundTruth(),
    fetchActualBaseline(),
    isPostBarterEnabled(),
  ]);

  const baselineBlock = baseline.hasData
    ? `ACTUAL RECENT PERFORMANCE (trailing 90 days, ${baseline.orderCount} real orders — use this as a grounded starting point, and only deviate from it where your research gives a specific reason, e.g. a planned ramp or new target cities):
- Orders/month (recent run-rate, all cities combined): ${baseline.ordersPerMonth}
- Average order value: ₹${baseline.avgOrderValueRupees}
- COD share of all orders: ${baseline.codSharePctOfAllOrders}%
- "Pay With A Post" share of all orders: ${baseline.postBarterSharePct}%
- RTO rate of COD orders: ${baseline.rtoRatePctOfCod}%`
    : `No meaningful order history yet (${baseline.orderCount} orders in the last 90 days) — treat this as a new/early-stage store and rely on researched category benchmarks instead of an internal baseline.`;

  const categoryBlock = categoryTruth
    .map((c) => `- ${c.label} (${c.skuCount} SKUs) — series key: "${c.series}"`)
    .join("\n");

  const shippingBlock = `SHIPPING & PAYMENT POLICY (fixed by the business, not for you to change):
- Prepaid orders: ${setup.shippingPolicy.prepaidMode === "free" ? "shipping is FREE to the customer" : `customer is charged ₹${setup.shippingPolicy.prepaidChargeRupees} shipping`}.
- Cash on Delivery: ${
    setup.shippingPolicy.codEnabled
      ? setup.shippingPolicy.codMode === "free"
        ? "ENABLED, shipping is FREE to the customer"
        : `ENABLED, customer is charged ₹${setup.shippingPolicy.codChargeRupees} shipping`
      : "NOT offered at all this quarter — set codSharePct to 0 and give every COD-related driver (codSharePct, codHandlingFeePct, rtoRatePct, rtoCostPerOrderRupees, ndrCostPerOrderRupees) a value of 0."
  }`;

  const postBarterBlock = postBarterEnabled
    ? `One additional real mechanic unique to this store: "Pay With A Post" — instead of paying, a shopper with a real Instagram following gets the Chapter for free in exchange for posting about it and driving referral orders via their own coupon code (see lib/post-barter.ts). Estimate what share of total orders will realistically go through this mechanic (postBarterSharePct) given the baseline above (or a conservative single-digit estimate if there's no baseline yet).`
    : `"Pay With A Post" (a barter mechanic where a shopper gets a Chapter for free in exchange for posting about it) exists in the codebase but is currently switched OFF (POST_BARTER_ENABLED is not "true"). Set postBarterSharePct to a value very close to 0 (0-1%) and say plainly in its rationale that the feature is currently disabled, so this driver is a placeholder rather than a researched estimate.`;

  const prompt = `You are building a 3-month benchmark P&L forecast for TRAVAHOLIC, a premium direct-to-consumer trucker-cap brand selling in India via its own website (travaholic.in, not a marketplace), under the tagline "Stories You Can Wear". The quarter being forecast starts ${quarterStart}.

TARGET CITIES for this quarter's push (real input from the business — plan volume and CAC per city, since both vary a lot by market): ${setup.targetCities.join(", ")}

OUR REAL PRODUCT CATEGORIES — "Story Series" (from our own database — ground truth prices/SKU counts, not for you to estimate):
${categoryBlock}

${shippingBlock}

${baselineBlock}

Use web search to ground the drivers below in real, current data: Indian D2C headwear/apparel-accessory category sizing and growth, competitor trucker-cap pricing, city-level customer acquisition cost benchmarks for fashion/accessories performance marketing in each target city (metro vs. tier-2 CPMs differ a lot), India COD-vs-prepaid share and COD RTO/NDR rate benchmarks for fashion e-commerce, typical Indian payment gateway fees, typical trucker-cap manufacturing cost (cotton/mesh fabric, embroidered patch, foam front panel) as a % of retail price, typical courier cost per order within India, typical D2C packaging cost per order, and typical fixed monthly costs (retainers, tooling, freelancers) for an early-stage Indian D2C brand. Cite what you find in each rationale. If you can't find solid data for a specific driver, say so explicitly in that driver's rationale and state you're using a general industry benchmark instead — never present a guess as if it were researched.

${postBarterBlock}

Then call submit_business_plan_drivers exactly once with your final drivers and rationale — one categories entry per series listed above, one cities entry per target city listed above, no more and no fewer. Do not output final rupee totals or profit numbers yourself — only the drivers. A human will edit these and a deterministic formula computes the P&L from them.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
      tools: [
        // Tool type as of today (2026-09-24) per Anthropic's docs — verify
        // this hasn't changed before relying on it in production.
        { type: "web_search_20250305", name: "web_search", max_uses: 8 },
        SUBMIT_TOOL,
      ],
      tool_choice: { type: "auto" },
    }),
  });
  if (!res.ok) throw new Error(`Claude API error: ${res.status} ${await res.text()}`);

  const data = await res.json();
  const modelDrivers = extractDriversFromToolUse(data.content ?? []);

  // Merge: ground truth (price/skuCount/label) + setup (targetCities/shippingPolicy) are
  // never taken from the model, only its researched %s/rupee estimates are.
  const categories: CategoryDriver[] = categoryTruth.map((truth) => {
    const fromModel = modelDrivers.categories.find((c) => c.series === truth.series);
    return {
      ...truth,
      shareOfOrdersPct: fromModel?.shareOfOrdersPct ?? Math.round(100 / categoryTruth.length),
      productCostPct: fromModel?.productCostPct ?? 40,
    };
  });

  return {
    targetCities: setup.targetCities,
    shippingPolicy: setup.shippingPolicy,
    categories,
    cities: modelDrivers.cities,
    packagingCostPerOrderRupees: modelDrivers.packagingCostPerOrderRupees,
    adminTechPct: modelDrivers.adminTechPct,
    codSharePct: setup.shippingPolicy.codEnabled ? modelDrivers.codSharePct : 0,
    paymentGatewayFeePct: modelDrivers.paymentGatewayFeePct,
    codHandlingFeePct: modelDrivers.codHandlingFeePct,
    rtoRatePct: modelDrivers.rtoRatePct,
    rtoCostPerOrderRupees: modelDrivers.rtoCostPerOrderRupees,
    ndrCostPerOrderRupees: modelDrivers.ndrCostPerOrderRupees,
    shippingCostPerOrderRupees: modelDrivers.shippingCostPerOrderRupees,
    postBarterSharePct: postBarterEnabled ? modelDrivers.postBarterSharePct : 0,
    fixedCostLines: modelDrivers.fixedCostLines.map((l, i) => ({ id: `fc-${i}-${Date.now()}`, ...l })),
    rationale: modelDrivers.rationale,
  };
}

// ---- Storage ----

export async function getBusinessPlan(quarterStart: string): Promise<BusinessPlanDrivers | null> {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("business_plans")
    .select("drivers")
    .eq("quarter_start", quarterStart)
    .maybeSingle();
  return (data?.drivers as BusinessPlanDrivers) ?? null;
}

export async function saveBusinessPlan(quarterStart: string, drivers: BusinessPlanDrivers) {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("business_plans")
    .upsert({ quarter_start: quarterStart, drivers, updated_at: new Date().toISOString() }, { onConflict: "quarter_start" });
  if (error) throw error;
}
