import { getSetting, setSetting } from "@/lib/settings";

const BASE_URL = "https://apiv2.shiprocket.in/v1/external";

// Every Chapter is a trucker cap — uniform enough to hardcode a shipping
// weight/box size rather than collect it per product. Adjust here if
// packaging changes; Shiprocket uses this only for courier rate calculation.
const UNIT_WEIGHT_KG = 0.2;
const BOX_DIMENSIONS_CM = { length: 25, breadth: 20, height: 10 };

type TokenCache = { token: string; expiresAt: string };

async function getShiprocketToken(): Promise<string> {
  const cached = await getSetting("SHIPROCKET_TOKEN_CACHE");
  if (cached) {
    const parsed = JSON.parse(cached) as TokenCache;
    if (new Date(parsed.expiresAt) > new Date()) return parsed.token;
  }

  const [email, password] = await Promise.all([
    getSetting("SHIPROCKET_EMAIL"),
    getSetting("SHIPROCKET_PASSWORD"),
  ]);
  if (!email || !password) {
    throw new Error("Shiprocket is not configured yet — add credentials in /admin/settings");
  }

  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Shiprocket login failed: ${res.status} ${await res.text()}`);

  const data = await res.json();
  const token = data.token as string;
  // Tokens are valid ~10 days; refresh a day early to be safe.
  const expiresAt = new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString();
  await setSetting("SHIPROCKET_TOKEN_CACHE", JSON.stringify({ token, expiresAt }));

  return token;
}

async function shiprocketFetch(path: string, init: RequestInit = {}) {
  const token = await getShiprocketToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Shiprocket API error (${path}): ${JSON.stringify(data)}`);
  return data;
}

export type ShiprocketOrderInput = {
  orderId: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  paymentMethod: "COD" | "Prepaid";
  subtotal: number;
  total: number;
  items: { name: string; sku: string; quantity: number; price: number }[];
};

/**
 * Creates a shipment on Shiprocket for an order. Splits customer_name into
 * first/last as a best guess (Shiprocket requires both) — fine for the vast
 * majority of names, worth a manual glance in Shiprocket's dashboard for
 * edge cases (single-word names, titles, etc).
 */
export async function createShiprocketOrder(order: ShiprocketOrderInput) {
  const pickupLocation = await getSetting("SHIPROCKET_PICKUP_LOCATION");
  if (!pickupLocation) {
    throw new Error("SHIPROCKET_PICKUP_LOCATION is not set — add it in /admin/settings");
  }

  const [firstName, ...rest] = order.customerName.trim().split(/\s+/);
  const lastName = rest.join(" ") || firstName;
  const totalWeight = Math.max(0.1, order.items.reduce((sum, i) => sum + i.quantity, 0) * UNIT_WEIGHT_KG);

  const data = await shiprocketFetch("/orders/create/adhoc", {
    method: "POST",
    body: JSON.stringify({
      order_id: order.orderId,
      order_date: order.createdAt.slice(0, 16).replace("T", " "),
      pickup_location: pickupLocation,
      billing_customer_name: firstName,
      billing_last_name: lastName,
      billing_address: order.addressLine,
      billing_city: order.city,
      billing_pincode: order.pincode,
      billing_state: order.state,
      billing_country: "India",
      billing_email: order.customerEmail,
      billing_phone: order.customerPhone.replace(/\D/g, "").slice(-10),
      shipping_is_billing: true,
      order_items: order.items.map((item) => ({
        name: item.name,
        sku: item.sku,
        units: item.quantity,
        selling_price: item.price,
      })),
      payment_method: order.paymentMethod,
      sub_total: order.subtotal,
      length: BOX_DIMENSIONS_CM.length,
      breadth: BOX_DIMENSIONS_CM.breadth,
      height: BOX_DIMENSIONS_CM.height,
      weight: totalWeight,
    }),
  });

  return {
    shiprocketOrderId: String(data.order_id),
    shipmentId: String(data.shipment_id),
  };
}

/**
 * Live shipping cost for a delivery pincode, straight from Shiprocket's own
 * rate-check API — this is what makes shipping a genuine pass-through
 * rather than a guessed flat fee. Returns the cheapest serviceable courier's
 * rate, rounded up to the rupee. Best-effort: returns null (rather than
 * throwing) if Shiprocket isn't configured or the pincode isn't
 * serviceable, so checkout can fall back to asking the customer to
 * double-check their pincode instead of hard-failing.
 */
export async function getShippingRate(deliveryPincode: string, unitCount: number) {
  const pickupPincode = await getSetting("SHIPROCKET_PICKUP_PINCODE");
  if (!pickupPincode) return null;

  const weight = Math.max(0.1, unitCount * UNIT_WEIGHT_KG);

  try {
    const data = await shiprocketFetch(
      `/courier/serviceability/?pickup_postcode=${pickupPincode}&delivery_postcode=${deliveryPincode}&weight=${weight}&cod=0`
    );
    const couriers = data?.data?.available_courier_companies as { rate: number }[] | undefined;
    if (!couriers || couriers.length === 0) return null;
    const cheapest = Math.min(...couriers.map((c) => c.rate));
    return Math.ceil(cheapest);
  } catch (err) {
    console.error("Shiprocket rate check failed", err);
    return null;
  }
}

export async function trackShiprocketShipment(shipmentId: string) {
  const data = await shiprocketFetch(`/courier/track/shipment/${shipmentId}`);
  const tracking = data[shipmentId]?.tracking_data;
  return {
    status: tracking?.shipment_track?.[0]?.current_status ?? null,
    awbCode: tracking?.shipment_track?.[0]?.awb_code ?? null,
    courierName: tracking?.shipment_track?.[0]?.courier_name ?? null,
  };
}
