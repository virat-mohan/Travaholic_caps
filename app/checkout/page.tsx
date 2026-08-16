"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { useDiscountRule } from "@/lib/useDiscountRule";
import { calculateDiscount } from "@/lib/discounts";
import { trackEvent, getSessionKey } from "@/lib/client-tracking";
import { NewsletterBlock } from "@/components/newsletter/NewsletterBlock";
import { FooterEditorial } from "@/components/footer/FooterEditorial";

const WHATSAPP_NUMBER = "919958871283";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

type Account = {
  customer: { id: string; phone: string | null; name: string | null; email: string | null; newsletter_subscribed: boolean } | null;
  addresses: {
    id: string;
    recipient_name: string;
    phone: string;
    address_line: string;
    city: string | null;
    state: string | null;
    pincode: string | null;
    is_default: boolean;
  }[];
  loyalty: { balance: number; maxRedeemableRupees: number; threshold: number } | null;
};

type IdentityStep = "checking" | "identify" | "otp" | "guest" | "verified";

export default function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const discountRule = useDiscountRule();
  const discount = calculateDiscount(items, discountRule);
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
  });
  const [isGift, setIsGift] = useState(false);
  const [giftNote, setGiftNote] = useState("");
  const [newsletterOptIn, setNewsletterOptIn] = useState(true);
  const [razorpay, setRazorpay] = useState<{ enabled: boolean; keyId: string | null }>({
    enabled: false,
    keyId: null,
  });
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [redeemMiles, setRedeemMiles] = useState(false);
  const [shippingCharge, setShippingCharge] = useState<number | null>(null);
  const [shippingUnavailable, setShippingUnavailable] = useState(false);
  // Distinct from shippingUnavailable: this specifically means Shiprocket
  // checked and confirmed it can't deliver to this pincode — a real RTO
  // risk, so it blocks payment. A plain "unavailable" (our config, or a
  // transient API hiccup) never blocks — see getShippingRate's doc comment.
  const [shippingBlocking, setShippingBlocking] = useState(false);

  // Identity-first flow: verify who's checking out before showing the full
  // order form, so a returning customer's address and Miles are pulled in
  // automatically instead of retyping everything. "Continue as guest" skips
  // straight to the manual form for anyone who'd rather not verify.
  const [identityStep, setIdentityStep] = useState<IdentityStep>("checking");
  const [identifyPhone, setIdentifyPhone] = useState("");
  const [identifyEmail, setIdentifyEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [identityLoading, setIdentityLoading] = useState(false);
  const [identityError, setIdentityError] = useState<string | null>(null);

  const loyaltyDiscount = redeemMiles ? account?.loyalty?.maxRedeemableRupees ?? 0 : 0;
  const total = Math.max(0, subtotal - discount - loyaltyDiscount) + (shippingCharge ?? 0);
  const unitCount = items.reduce((sum, item) => sum + item.quantity, 0);

  // Live pass-through shipping quote from Shiprocket, by pincode — a
  // display-only preview; the actual charge is recomputed server-side from
  // the same pincode when the order is placed, so this can never be spoofed
  // into a lower number by the client.
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!/^\d{6}$/.test(form.pincode)) {
        setShippingCharge(null);
        setShippingUnavailable(false);
        setShippingBlocking(false);
        return;
      }
      fetch("/api/checkout/shipping-rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pincode: form.pincode, unitCount }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.available) {
            setShippingCharge(data.rate);
            setShippingUnavailable(false);
            setShippingBlocking(false);
          } else {
            setShippingCharge(null);
            setShippingUnavailable(true);
            setShippingBlocking(!!data.blocking);
          }
        })
        .catch(() => {
          setShippingCharge(null);
          setShippingUnavailable(false);
          setShippingBlocking(false);
        });
    }, 500);
    return () => clearTimeout(timeout);
  }, [form.pincode, unitCount]);

  useEffect(() => {
    fetch("/api/checkout/config")
      .then((res) => res.json())
      .then((data) => setRazorpay({ enabled: !!data.razorpayEnabled, keyId: data.razorpayKeyId }))
      .catch(() => setRazorpay({ enabled: false, keyId: null }));
  }, []);

  function applyAccount(data: Account) {
    setAccount(data);
    if (data.customer) {
      const defaultAddress = data.addresses.find((a) => a.is_default) ?? data.addresses[0];
      setForm((f) => ({
        name: f.name || data.customer?.name || defaultAddress?.recipient_name || "",
        phone: f.phone || data.customer?.phone || defaultAddress?.phone || "",
        email: f.email || data.customer?.email || "",
        address: f.address || defaultAddress?.address_line || "",
        city: f.city || defaultAddress?.city || "",
        state: f.state || defaultAddress?.state || "",
        pincode: f.pincode || defaultAddress?.pincode || "",
      }));
      setIdentityStep("verified");
    } else {
      setIdentityStep("identify");
    }
  }

  useEffect(() => {
    fetch("/api/account/me")
      .then((res) => res.json())
      .then(applyAccount)
      .catch(() => setIdentityStep("identify"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (items.length > 0) trackEvent("InitiateCheckout", { value: total });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced cart-session capture — this is what makes an abandoned cart
  // retargetable at all: the moment a shopper has typed a phone/email, we
  // know who they are even if they never finish paying.
  useEffect(() => {
    if (!form.name && !form.phone && !form.email) return;
    const timeout = setTimeout(() => {
      fetch("/api/cart-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionKey: getSessionKey(),
          name: form.name,
          phone: form.phone,
          email: form.email,
          items,
          subtotal: total,
        }),
      }).catch(() => {});
    }, 1200);
    return () => clearTimeout(timeout);
  }, [form, items, total]);

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function logOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    setAccount(null);
    setRedeemMiles(false);
    setIdentityStep("identify");
  }

  async function sendIdentifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!identifyPhone.trim() && !identifyEmail.trim()) {
      setIdentityError("Enter a phone number or an email address.");
      return;
    }
    setIdentityLoading(true);
    setIdentityError(null);
    try {
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: identifyPhone.trim() || null, email: identifyEmail.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send code");
      setIdentityStep("otp");
    } catch (err) {
      setIdentityError(err instanceof Error ? err.message : "Could not send code");
    } finally {
      setIdentityLoading(false);
    }
  }

  async function verifyIdentifyCode(e: React.FormEvent) {
    e.preventDefault();
    setIdentityLoading(true);
    setIdentityError(null);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: identifyPhone.trim() || null,
          email: identifyEmail.trim() || null,
          code: otpCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not verify code");
      const me = await fetch("/api/account/me").then((r) => r.json());
      applyAccount(me);
    } catch (err) {
      setIdentityError(err instanceof Error ? err.message : "Could not verify code");
    } finally {
      setIdentityLoading(false);
    }
  }

  async function handleRazorpayPayment() {
    setPayError(null);
    setPaying(true);
    try {
      const cartItems = items.map((i) => ({ slug: i.slug, quantity: i.quantity }));
      const createRes = await fetch("/api/checkout/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cartItems, redeemMilesRupees: loyaltyDiscount, pincode: form.pincode }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error ?? "Could not start payment");

      const rzp = new window.Razorpay({
        key: createData.keyId,
        order_id: createData.razorpayOrderId,
        amount: Math.round(createData.total * 100),
        currency: "INR",
        name: "Travaholic",
        description: "Order payment",
        prefill: { name: form.name, email: form.email, contact: form.phone },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const verifyRes = await fetch("/api/checkout/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...response,
                order: {
                  customer: form,
                  items: cartItems,
                  isGift,
                  giftNote: isGift ? giftNote : null,
                  sessionKey: getSessionKey(),
                  redeemMilesRupees: loyaltyDiscount,
                  newsletterOptIn,
                },
              }),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error ?? "Payment verification failed");
            trackEvent("Purchase", { value: createData.total });
            clear();
            router.push("/checkout/confirmed");
          } catch (err) {
            setPayError(err instanceof Error ? err.message : "Payment verification failed");
          } finally {
            setPaying(false);
          }
        },
        modal: {
          ondismiss: () => setPaying(false),
        },
      });
      rzp.open();
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Could not start payment");
      setPaying(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (razorpay.enabled) {
      await handleRazorpayPayment();
      return;
    }

    try {
      await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: form,
          items: items.map((i) => ({
            slug: i.slug,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
          })),
          subtotal,
          discountAmount: discount,
          isGift,
          giftNote: isGift ? giftNote : null,
          sessionKey: getSessionKey(),
          redeemMilesRupees: loyaltyDiscount,
          newsletterOptIn,
        }),
      });
      trackEvent("Purchase", { value: total });
    } catch (err) {
      // Best-effort logging — WhatsApp remains the real order channel either way.
      console.error("Order logging failed", err);
    }

    const lines = [
      "New order from travaholic.in",
      "",
      ...items.map((i) => `${i.quantity} x ${i.name} — ₹${(i.price * i.quantity).toLocaleString("en-IN")}`),
      "",
      `Subtotal: ₹${subtotal.toLocaleString("en-IN")}`,
      ...(discount > 0 ? [`Discount: −₹${discount.toLocaleString("en-IN")}`] : []),
      ...(loyaltyDiscount > 0 ? [`Travaholic Miles redeemed: −₹${loyaltyDiscount.toLocaleString("en-IN")}`] : []),
      ...(shippingCharge ? [`Shipping: ₹${shippingCharge.toLocaleString("en-IN")}`] : []),
      `Total: ₹${total.toLocaleString("en-IN")}`,
      "",
      `Name: ${form.name}`,
      `Phone: ${form.phone}`,
      `Email: ${form.email}`,
      `Address: ${form.address}, ${form.city}, ${form.state} ${form.pincode}`,
      ...(isGift ? ["", "This is a gift.", `Gift note: ${giftNote || "(none)"}`] : []),
    ];

    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank");
    clear();
    router.push("/checkout/confirmed");
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto w-full max-w-[700px] px-6 pt-32 pb-24 text-center md:px-12 md:pt-40">
        <p className="font-display text-heading-l uppercase text-ink">Your Cart Is Empty.</p>
        <Link
          href="/series"
          className="mt-6 inline-block border border-ink px-8 py-3 font-sans text-body-s font-bold uppercase tracking-[0.1em] text-ink transition-colors duration-300 hover:bg-ink hover:text-cream"
        >
          Browse The Series
        </Link>
      </main>
    );
  }

  const orderSummary = (
    <div className="mt-4 space-y-2 border-y border-divider py-6">
      {items.map((item) => (
        <div key={item.slug} className="flex items-center justify-between text-body-s">
          <span className="text-ink">
            {item.quantity} × {item.name}
          </span>
          <span className="text-secondary-text">₹{(item.price * item.quantity).toLocaleString("en-IN")}</span>
        </div>
      ))}
      {discount > 0 && discountRule && (
        <div className="flex items-center justify-between text-body-s">
          <span className="text-tan-gold">{discountRule.name}</span>
          <span className="text-tan-gold">−₹{discount.toLocaleString("en-IN")}</span>
        </div>
      )}
      {loyaltyDiscount > 0 && (
        <div className="flex items-center justify-between text-body-s">
          <span className="text-tan-gold">Travaholic Miles Redeemed</span>
          <span className="text-tan-gold">−₹{loyaltyDiscount.toLocaleString("en-IN")}</span>
        </div>
      )}
      {shippingCharge != null && (
        <div className="flex items-center justify-between text-body-s">
          <span className="text-secondary-text">Shipping</span>
          <span className="text-secondary-text">₹{shippingCharge.toLocaleString("en-IN")}</span>
        </div>
      )}
      {shippingBlocking && (
        <p className="text-caption text-paint-orange">
          We can&apos;t currently deliver to that pincode — please double-check it or use a different
          address before continuing.
        </p>
      )}
      {shippingUnavailable && !shippingBlocking && (
        <p className="text-caption text-paint-orange">
          We couldn&apos;t find delivery rates for that pincode — double-check it, or we&apos;ll confirm
          shipping with you directly.
        </p>
      )}
      <div className="flex items-center justify-between pt-3 font-display text-heading-s text-ink">
        <span>Total</span>
        <span>₹{total.toLocaleString("en-IN")}</span>
      </div>
    </div>
  );

  return (
    <>
      <main className="mx-auto w-full max-w-[700px] px-6 pt-32 pb-24 md:px-12 md:pt-40">
        <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">Checkout</p>
        <h1 className="mt-2 font-display text-heading-xl uppercase text-ink md:text-display-m">
          Almost Done.
        </h1>

        {(identityStep === "identify" || identityStep === "otp") && (
          <>
            <p className="mt-4 max-w-md text-body-s text-secondary-text">
              Enter your phone or email — if you&apos;ve ordered before, we&apos;ll pull in your
              address and Travaholic Miles automatically.
            </p>
            {orderSummary}

            {identityStep === "identify" ? (
              <form onSubmit={sendIdentifyCode} className="mt-8 space-y-5">
                <div>
                  <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={identifyPhone}
                    onChange={(e) => setIdentifyPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    className="mt-3 w-full border border-ink/30 bg-surface px-5 py-3 font-sans text-body-s text-ink outline-none placeholder:text-secondary-text focus:border-ink"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-divider" />
                  <span className="text-micro uppercase tracking-[0.1em] text-secondary-text">Or</span>
                  <div className="h-px flex-1 bg-divider" />
                </div>
                <div>
                  <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
                    Email
                  </label>
                  <input
                    type="email"
                    value={identifyEmail}
                    onChange={(e) => setIdentifyEmail(e.target.value)}
                    placeholder="you@email.com"
                    className="mt-3 w-full border border-ink/30 bg-surface px-5 py-3 font-sans text-body-s text-ink outline-none placeholder:text-secondary-text focus:border-ink"
                  />
                </div>
                {identityError && <p className="text-body-s text-paint-orange">{identityError}</p>}
                <button
                  type="submit"
                  disabled={identityLoading}
                  className="w-full border border-ink bg-ink px-8 py-4 font-sans text-body-s font-bold uppercase tracking-[0.1em] text-cream transition-colors duration-300 hover:bg-cream hover:text-ink disabled:opacity-60"
                >
                  {identityLoading ? "Sending..." : "Continue"}
                </button>
                <button
                  type="button"
                  onClick={() => setIdentityStep("guest")}
                  className="w-full text-center text-caption text-secondary-text underline"
                >
                  Continue As Guest
                </button>
              </form>
            ) : (
              <form onSubmit={verifyIdentifyCode} className="mt-8 space-y-5">
                <p className="text-body-s text-secondary-text">
                  Enter the 6-digit code sent to {identifyEmail.trim() || identifyPhone.trim()}.
                </p>
                <input
                  required
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  maxLength={6}
                  className="w-full border border-ink/30 bg-surface px-5 py-3 font-sans text-heading-s tracking-[0.3em] text-ink outline-none focus:border-ink"
                />
                {identityError && <p className="text-body-s text-paint-orange">{identityError}</p>}
                <button
                  type="submit"
                  disabled={identityLoading}
                  className="w-full border border-ink bg-ink px-8 py-4 font-sans text-body-s font-bold uppercase tracking-[0.1em] text-cream transition-colors duration-300 hover:bg-cream hover:text-ink disabled:opacity-60"
                >
                  {identityLoading ? "Verifying..." : "Verify & Continue"}
                </button>
                <button
                  type="button"
                  onClick={() => setIdentityStep("identify")}
                  className="w-full text-center text-caption text-secondary-text underline"
                >
                  Start Over
                </button>
              </form>
            )}
          </>
        )}

        {(identityStep === "verified" || identityStep === "guest") && (
          <>
            <p className="mt-4 max-w-md text-body-s text-secondary-text">
              {razorpay.enabled
                ? "Pay securely below and we'll email your invoice and confirm right after."
                : "We don't run this through a payment gateway yet — placing an order sends your details and cart straight to us on WhatsApp, and we'll confirm payment and delivery with you directly."}
            </p>

            <div className="mt-6 flex items-center justify-between border-t border-divider pt-4 text-body-s">
              {identityStep === "verified" && account?.customer ? (
                <>
                  <span className="text-secondary-text">
                    Logged in as{" "}
                    <span className="text-ink">{account.customer.phone || account.customer.email}</span>
                    {account.loyalty && account.loyalty.balance > 0 && (
                      <> · {account.loyalty.balance.toLocaleString("en-IN")} Travaholic Miles</>
                    )}
                  </span>
                  <button type="button" onClick={logOut} className="text-caption text-secondary-text underline">
                    Log Out
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setIdentityStep("identify")}
                  className="text-caption text-ink underline"
                >
                  Have an account? Verify for faster checkout &amp; Miles
                </button>
              )}
            </div>

            {orderSummary}

            {account?.loyalty && account.loyalty.maxRedeemableRupees > 0 && (
              <label className="mt-4 flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={redeemMiles}
                  onChange={(e) => setRedeemMiles(e.target.checked)}
                  className="h-4 w-4 accent-ink"
                />
                <span className="font-sans text-body-s text-ink">
                  Redeem Travaholic Miles for ₹{account.loyalty.maxRedeemableRupees.toLocaleString("en-IN")} off
                </span>
              </label>
            )}

            <form onSubmit={handleSubmit} className="mt-10 space-y-6">
              <div>
                <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
                  Full Name
                </label>
                <input
                  required
                  value={form.name}
                  onChange={update("name")}
                  className="mt-3 w-full border border-ink/30 bg-surface px-5 py-3 font-sans text-body-s text-ink outline-none focus:border-ink"
                />
              </div>

              <div>
                <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
                  Phone
                </label>
                <input
                  required
                  type="tel"
                  value={form.phone}
                  onChange={update("phone")}
                  className="mt-3 w-full border border-ink/30 bg-surface px-5 py-3 font-sans text-body-s text-ink outline-none focus:border-ink"
                />
              </div>

              <div>
                <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
                  Email
                </label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={update("email")}
                  className="mt-3 w-full border border-ink/30 bg-surface px-5 py-3 font-sans text-body-s text-ink outline-none focus:border-ink"
                />
              </div>

              <div>
                <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
                  Delivery Address
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="House/flat, street, area"
                  value={form.address}
                  onChange={update("address")}
                  className="mt-3 w-full border border-ink/30 bg-surface px-5 py-3 font-sans text-body-s text-ink outline-none placeholder:text-secondary-text focus:border-ink"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
                    City
                  </label>
                  <input
                    required
                    value={form.city}
                    onChange={update("city")}
                    className="mt-3 w-full border border-ink/30 bg-surface px-5 py-3 font-sans text-body-s text-ink outline-none focus:border-ink"
                  />
                </div>
                <div>
                  <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
                    State
                  </label>
                  <input
                    required
                    value={form.state}
                    onChange={update("state")}
                    className="mt-3 w-full border border-ink/30 bg-surface px-5 py-3 font-sans text-body-s text-ink outline-none focus:border-ink"
                  />
                </div>
              </div>

              <div>
                <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
                  Pincode
                </label>
                <input
                  required
                  value={form.pincode}
                  onChange={update("pincode")}
                  className="mt-3 w-full max-w-[200px] border border-ink/30 bg-surface px-5 py-3 font-sans text-body-s text-ink outline-none focus:border-ink"
                />
              </div>

              <div className="border-t border-divider pt-6">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isGift}
                    onChange={(e) => setIsGift(e.target.checked)}
                    className="h-4 w-4 accent-ink"
                  />
                  <span className="font-sans text-body-s uppercase tracking-[0.05em] text-ink">
                    This is a gift
                  </span>
                </label>

                {isGift && (
                  <textarea
                    rows={3}
                    placeholder="Add a personal note to include with the order..."
                    value={giftNote}
                    onChange={(e) => setGiftNote(e.target.value)}
                    className="mt-4 w-full border border-ink/30 bg-surface px-5 py-3 font-sans text-body-s text-ink outline-none placeholder:text-secondary-text focus:border-ink"
                  />
                )}

                <label className="mt-4 flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={newsletterOptIn}
                    onChange={(e) => setNewsletterOptIn(e.target.checked)}
                    className="h-4 w-4 accent-ink"
                  />
                  <span className="font-sans text-body-s text-ink">
                    Send me new Chapters, travel stories and Journal updates
                  </span>
                </label>
              </div>

              {payError && <p className="text-body-s text-paint-orange">{payError}</p>}

              <button
                type="submit"
                disabled={paying || shippingBlocking}
                className="w-full border border-ink bg-ink px-8 py-4 font-sans text-body-s font-bold uppercase tracking-[0.1em] text-cream transition-colors duration-300 hover:bg-cream hover:text-ink disabled:opacity-60"
              >
                {shippingBlocking
                  ? "Undeliverable Pincode"
                  : razorpay.enabled
                    ? paying
                      ? "Processing..."
                      : `Pay ₹${total.toLocaleString("en-IN")}`
                    : "Place Order via WhatsApp"}
              </button>
            </form>
          </>
        )}
      </main>

      {razorpay.enabled && <Script src="https://checkout.razorpay.com/v1/checkout.js" />}

      <NewsletterBlock />
      <FooterEditorial />
    </>
  );
}
