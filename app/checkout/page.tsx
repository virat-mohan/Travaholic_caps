"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { useDiscountRule } from "@/lib/useDiscountRule";
import { calculateDiscount } from "@/lib/discounts";
import { trackEvent, getSessionKey, getAttribution, getReferralCode } from "@/lib/client-tracking";
import { FooterEditorial } from "@/components/footer/FooterEditorial";
import { CheckoutSteps } from "@/components/checkout/CheckoutSteps";
import { PayWithAPostMark } from "@/components/ui/PayWithAPostMark";
import { PENDING_COUPON_KEY } from "@/components/tracking/CouponCapture";

const WHATSAPP_NUMBER = "918800339125";

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

type IdentityStep = "guest" | "verified";

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
  const [razorpay, setRazorpay] = useState<{ enabled: boolean; keyId: string | null; codAdvanceRupees: number }>({
    enabled: false,
    keyId: null,
    codAdvanceRupees: 99,
  });
  const [postBarter, setPostBarter] = useState<{ enabled: boolean; minFollowers: number; requiredOrders: number }>({
    enabled: false,
    minFollowers: 5000,
    requiredOrders: 3,
  });
  const [barterHandle, setBarterHandle] = useState("");
  const [barterPreview, setBarterPreview] = useState<
    { tier: "gift_first" | "sell_first"; followerCount: number | null; verificationCode: string | null } | null
  >(null);
  const [barterChecking, setBarterChecking] = useState(false);
  const [barterSubmitting, setBarterSubmitting] = useState(false);
  const [barterError, setBarterError] = useState<string | null>(null);
  const [ownershipVerified, setOwnershipVerified] = useState(false);
  const [giftFirstTermsAccepted, setGiftFirstTermsAccepted] = useState(false);
  // razorpay.enabled defaults to false until /api/checkout/config resolves —
  // without this separate flag, a customer submitting the form before that
  // fetch completes (a real risk: it's an async call fired on mount) would
  // silently fall through to the WhatsApp-manual-order path instead of
  // actually being charged via Razorpay, even though Razorpay is properly
  // configured. The submit button stays disabled until this is true.
  const [configLoaded, setConfigLoaded] = useState(false);
  // Only seeded from a real `?ref=` link capture (see captureReferral in
  // lib/client-tracking.ts) — typing a code here is deliberately local
  // component state only, not persisted, so a code tried once doesn't keep
  // silently re-applying itself on unrelated future checkouts.
  const [referralCodeInput, setReferralCodeInput] = useState(() => getReferralCode() ?? "");
  const [referralPreview, setReferralPreview] = useState<{ checked: string; valid: boolean; discountRupees: number } | null>(null);
  const [referralChecking, setReferralChecking] = useState(false);
  function updateReferralCode(value: string) {
    setReferralCodeInput(value);
  }
  // Pre-filled from a ?coupon= landing link (see CouponCapture) so a shopper
  // arriving from a Pay With A Post share never has to retype the code.
  const [couponCodeInput, setCouponCodeInput] = useState("");
  useEffect(() => {
    try {
      const pending = localStorage.getItem(PENDING_COUPON_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from browser storage after mount, not derived state
      if (pending) setCouponCodeInput(pending);
    } catch {
      // storage unavailable — the shopper can still type the code
    }
  }, []);
  const [couponPreview, setCouponPreview] = useState<{ checked: string; valid: boolean; discountRupees: number } | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [redeemMiles, setRedeemMiles] = useState(false);
  // Prepaid ships free nationwide; COD charges the real Shiprocket rate
  // (collected by the courier alongside the balance due) plus a small
  // upfront advance to filter out fake/non-serious COD orders.
  const [paymentType, setPaymentType] = useState<"prepaid" | "cod_advance" | "post_barter">("prepaid");
  const [shippingCharge, setShippingCharge] = useState<number | null>(null);
  const [shippingUnavailable, setShippingUnavailable] = useState(false);
  // Distinct from shippingUnavailable: this specifically means Shiprocket
  // checked and confirmed it can't deliver to this pincode — a real RTO
  // risk, so it blocks payment. A plain "unavailable" (our config, or a
  // transient API hiccup) never blocks — see getShippingRate's doc comment.
  const [shippingBlocking, setShippingBlocking] = useState(false);
  // Pincode is deliverable prepaid but no courier offers COD on that lane —
  // COD gets hidden rather than letting an order through that would strand
  // at courier assignment.
  const [codUnavailable, setCodUnavailable] = useState(false);

  // Straight-to-the-form flow: starts as "guest" so the form renders
  // immediately instead of waiting on the account-check network round trip
  // (that used to gate the whole page behind a blank "checking" state — a
  // real pause on a slow connection). A returning logged-in customer's
  // saved address/Miles still get pulled in a moment later once
  // applyAccount resolves, upgrading in place to "verified" without ever
  // blocking the initial render. Removed the email/OTP login entry point
  // for now; git history has it if it's needed back.
  const [identityStep, setIdentityStep] = useState<IdentityStep>("guest");

  const loyaltyDiscount = redeemMiles ? account?.loyalty?.maxRedeemableRupees ?? 0 : 0;
  const normalizedReferralCode = referralCodeInput.trim().toUpperCase();
  const referralDiscount =
    referralPreview?.checked === normalizedReferralCode && referralPreview.valid
      ? Math.min(referralPreview.discountRupees, subtotal)
      : 0;
  const normalizedCouponCode = couponCodeInput.trim().toUpperCase();
  const couponDiscount =
    couponPreview?.checked === normalizedCouponCode && couponPreview.valid
      ? Math.min(couponPreview.discountRupees, subtotal)
      : 0;
  // Free-shipping-on-prepaid is what the customer is actually charged;
  // shippingCharge itself always holds the real Shiprocket rate (needed to
  // confirm the pincode is even deliverable, and shown as-is for COD).
  const displayShippingCharge = paymentType === "prepaid" ? 0 : (shippingCharge ?? 0);
  const total =
    Math.max(0, subtotal - discount - loyaltyDiscount - referralDiscount - couponDiscount) +
    displayShippingCharge;
  const unitCount = items.reduce((sum, item) => sum + item.quantity, 0);

  // Live referral-code validation — mirrors resolveReferralDiscount's rules
  // (self-referral, one-time-per-customer) so the total shown before payment
  // matches what create-order/verify will actually charge, instead of the
  // shopper only finding out the code didn't apply after paying.
  useEffect(() => {
    const code = normalizedReferralCode;
    const timeout = setTimeout(() => {
      if (!code) {
        setReferralPreview(null);
        return;
      }
      setReferralChecking(true);
      fetch("/api/checkout/referral-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referralCode: code, phone: form.phone }),
      })
        .then((res) => res.json())
        .then((data) => setReferralPreview({ checked: code, valid: !!data.valid, discountRupees: data.discountRupees ?? 0 }))
        .catch(() => setReferralPreview({ checked: code, valid: false, discountRupees: 0 }))
        .finally(() => setReferralChecking(false));
    }, 500);
    return () => clearTimeout(timeout);
  }, [normalizedReferralCode, form.phone]);

  // Explicit "Apply" action rather than live-as-you-type (unlike the
  // referral code above) — checked once, on click, not on every keystroke.
  function applyCoupon() {
    const code = normalizedCouponCode;
    if (!code) {
      setCouponPreview(null);
      return;
    }
    setCouponChecking(true);
    fetch("/api/checkout/coupon-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ couponCode: code, subtotal }),
    })
      .then((res) => res.json())
      .then((data) => setCouponPreview({ checked: code, valid: !!data.valid, discountRupees: data.discountRupees ?? 0 }))
      .catch(() => setCouponPreview({ checked: code, valid: false, discountRupees: 0 }))
      .finally(() => setCouponChecking(false));
  }

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
            const noCod = data.codAvailable === false;
            setCodUnavailable(noCod);
            if (noCod) setPaymentType((p) => (p === "cod_advance" ? "prepaid" : p));
          } else {
            setShippingCharge(null);
            setShippingUnavailable(true);
            setShippingBlocking(!!data.blocking);
            setCodUnavailable(false);
          }
        })
        .catch(() => {
          setShippingCharge(null);
          setShippingUnavailable(false);
          setShippingBlocking(false);
          setCodUnavailable(false);
        });
    }, 500);
    return () => clearTimeout(timeout);
  }, [form.pincode, unitCount]);

  // Auto-fills city/state from the pincode so the shopper only has to type
  // one thing instead of three — India Post's public lookup, no API key
  // needed. Never overwrites a city/state the shopper already typed
  // themselves (e.g. after switching back from a different pincode).
  useEffect(() => {
    if (!/^\d{6}$/.test(form.pincode)) return;
    let cancelled = false;
    fetch(`https://api.postalpincode.in/pincode/${form.pincode}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const office = data?.[0]?.PostOffice?.[0];
        if (!office) return;
        setForm((prev) => ({
          ...prev,
          city: prev.city || office.District,
          state: prev.state || office.State,
        }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [form.pincode]);

  useEffect(() => {
    fetch("/api/checkout/config")
      .then((res) => res.json())
      .then((data) => {
        setRazorpay({
          enabled: !!data.razorpayEnabled,
          keyId: data.razorpayKeyId,
          codAdvanceRupees: data.codAdvanceRupees ?? 99,
        });
        setPostBarter({
          enabled: !!data.postBarterEnabled,
          minFollowers: data.postBarterMinFollowers ?? 5000,
          requiredOrders: data.postBarterRequiredOrders ?? 3,
        });
      })
      .catch(() => {
        setRazorpay({ enabled: false, keyId: null, codAdvanceRupees: 99 });
        setPostBarter({ enabled: false, minFollowers: 5000, requiredOrders: 3 });
      })
      .finally(() => setConfigLoaded(true));
  }, []);

  async function checkBarterTier() {
    if (!barterHandle.trim()) return;
    setBarterChecking(true);
    setBarterPreview(null);
    setOwnershipVerified(false);
    try {
      const res = await fetch("/api/checkout/post-barter/check-eligibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instagramHandle: barterHandle.trim() }),
      });
      const data = await res.json();
      setBarterPreview(res.ok ? data : null);
    } catch {
      setBarterPreview(null);
    } finally {
      setBarterChecking(false);
    }
  }

  async function verifyBarterOwnership() {
    if (!barterPreview?.verificationCode) return;
    try {
      const res = await fetch("/api/checkout/post-barter/verify-ownership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instagramHandle: barterHandle.trim(), code: barterPreview.verificationCode }),
      });
      const data = await res.json();
      setOwnershipVerified(!!data.verified);
      if (!data.verified) setBarterError("Couldn't find that code in your bio yet — add it and try again.");
      else setBarterError(null);
    } catch {
      setOwnershipVerified(false);
    }
  }

  async function handlePostBarterSubmit() {
    setBarterError(null);
    if (!barterHandle.trim()) {
      setBarterError("Enter your Instagram handle.");
      return;
    }
    if (unitCount !== 1) {
      setBarterError("Pay With A Post covers one item per order — adjust your cart to a single item.");
      return;
    }
    if (barterPreview?.tier === "gift_first" && ownershipVerified && !giftFirstTermsAccepted) {
      setBarterError("Please accept the terms above to ship now.");
      return;
    }
    setBarterSubmitting(true);
    try {
      const res = await fetch("/api/checkout/post-barter/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: form,
          items: items.map((i) => ({ slug: i.slug, quantity: i.quantity })),
          instagramHandle: barterHandle.trim(),
          ownershipCode: ownershipVerified ? barterPreview?.verificationCode : undefined,
          termsAccepted: giftFirstTermsAccepted,
          isGift,
          giftNote: isGift ? giftNote : null,
          sessionKey: getSessionKey(),
          newsletterOptIn,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create your order");
      trackEvent("Purchase", { value: 0, eventId: data.orderId, contentIds: items.map((i) => i.slug) });
      clear();
      router.push(`/barter/${data.orderId}`);
    } catch (err) {
      setBarterError(err instanceof Error ? err.message : "Could not create your order");
    } finally {
      setBarterSubmitting(false);
    }
  }

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
      setIdentityStep("guest");
    }
  }

  useEffect(() => {
    fetch("/api/account/me")
      .then((res) => res.json())
      .then(applyAccount)
      .catch(() => setIdentityStep("guest"));
  }, []);

  useEffect(() => {
    if (items.length > 0) {
      trackEvent("InitiateCheckout", { value: total, contentIds: items.map((i) => i.slug) });
    }
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
    setIdentityStep("guest");
  }

  async function handleRazorpayPayment() {
    setPayError(null);
    setPaying(true);
    try {
      const cartItems = items.map((i) => ({ slug: i.slug, quantity: i.quantity }));
      // Built once, sent to both create-order (as a recoverable snapshot —
      // see pending_orders) and verify (the actual source of truth) so the
      // two can never drift apart.
      const orderPayload = {
        customer: form,
        items: cartItems,
        isGift,
        giftNote: isGift ? giftNote : null,
        sessionKey: getSessionKey(),
        redeemMilesRupees: loyaltyDiscount,
        newsletterOptIn,
        paymentType,
        attributedAdBriefId: getAttribution(),
        referralCode: referralCodeInput.trim().toUpperCase() || null,
        couponCode: couponCodeInput.trim().toUpperCase() || null,
      };
      const createRes = await fetch("/api/checkout/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cartItems,
          redeemMilesRupees: loyaltyDiscount,
          pincode: form.pincode,
          paymentType,
          phone: form.phone,
          referralCode: referralCodeInput.trim().toUpperCase() || null,
          couponCode: couponCodeInput.trim().toUpperCase() || null,
          order: orderPayload,
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error ?? "Could not start payment");

      const rzp = new window.Razorpay({
        key: createData.keyId,
        order_id: createData.razorpayOrderId,
        amount: Math.round(createData.chargeAmount * 100),
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
                order: orderPayload,
              }),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error ?? "Payment verification failed");
            trackEvent("Purchase", {
              value: createData.total,
              eventId: verifyData.orderId,
              contentIds: items.map((i) => i.slug),
            });
            clear();
            router.push(`/checkout/confirmed?order=${verifyData.orderId}&paid=1`);
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

    if (!configLoaded) return; // guarded — see the disabled submit button below

    if (paymentType === "post_barter") {
      await handlePostBarterSubmit();
      return;
    }

    if (razorpay.enabled) {
      await handleRazorpayPayment();
      return;
    }

    let createdOrderId: string | null = null;
    try {
      const res = await fetch("/api/orders", {
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
          attributedAdBriefId: getAttribution(),
          referralCode: referralCodeInput.trim().toUpperCase() || null,
          couponCode: couponCodeInput.trim().toUpperCase() || null,
        }),
      });
      const data = await res.json().catch(() => null);
      createdOrderId = data?.orderId ?? null;
      trackEvent("Purchase", {
        value: total,
        eventId: createdOrderId ?? undefined,
        contentIds: items.map((i) => i.slug),
      });
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
      ...(displayShippingCharge ? [`Shipping: ₹${displayShippingCharge.toLocaleString("en-IN")}`] : []),
      `Total: ₹${total.toLocaleString("en-IN")}`,
      "",
      `Name: ${form.name}`,
      `Phone: ${form.phone}`,
      ...(form.email ? [`Email: ${form.email}`] : []),
      `Address: ${form.address}, ${form.city}, ${form.state} ${form.pincode}`,
      ...(isGift ? ["", "This is a gift.", `Gift note: ${giftNote || "(none)"}`] : []),
    ];

    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank");
    clear();
    router.push(createdOrderId ? `/checkout/confirmed?order=${createdOrderId}` : "/checkout/confirmed");
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
      {referralDiscount > 0 && (
        <div className="flex items-center justify-between text-body-s">
          <span className="text-tan-gold">Referral Code ({normalizedReferralCode})</span>
          <span className="text-tan-gold">−₹{referralDiscount.toLocaleString("en-IN")}</span>
        </div>
      )}
      {couponDiscount > 0 && (
        <div className="flex items-center justify-between text-body-s">
          <span className="text-tan-gold">Coupon ({normalizedCouponCode})</span>
          <span className="text-tan-gold">−₹{couponDiscount.toLocaleString("en-IN")}</span>
        </div>
      )}
      {shippingCharge != null && (
        <div className="flex items-center justify-between text-body-s">
          <span className="text-secondary-text">Shipping</span>
          {paymentType === "prepaid" ? (
            <span className="text-tan-gold">FREE</span>
          ) : (
            <span className="text-secondary-text">₹{shippingCharge.toLocaleString("en-IN")}</span>
          )}
        </div>
      )}
      {shippingBlocking && (
        <p className="text-caption text-paint-orange">
          Sorry — this pincode is not serviceable by our couriers yet, so we can&apos;t deliver there.
          Please double-check it or use a different delivery address to continue.
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
        <span>{paymentType === "post_barter" ? "To Be Paid With A Post" : `₹${total.toLocaleString("en-IN")}`}</span>
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
        <CheckoutSteps current="checkout" />

        {(identityStep === "verified" || identityStep === "guest") && (
          <>
            <p className="mt-4 max-w-md text-body-s text-secondary-text">
              {razorpay.enabled
                ? "Pay securely below and we'll email your invoice."
                : "We don't run this through a payment gateway yet — placing an order sends your details and cart straight to us on WhatsApp, and we'll confirm payment and delivery with you directly."}
            </p>

            {identityStep === "verified" && account?.customer && (
              <div className="mt-6 flex items-center justify-between border-t border-divider pt-4 text-body-s">
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
              </div>
            )}

            {razorpay.enabled && (
              <div className="mt-6 border-2 border-ink bg-tan-gold/20 p-4">
                <p className="font-sans text-body-m font-bold uppercase tracking-[0.03em] text-ink">
                  Pay in full — ship free, anywhere in India.
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setPaymentType("prepaid")}
                    className={`relative flex-1 border px-4 py-2.5 text-left font-sans text-body-s transition-colors duration-200 ${
                      paymentType === "prepaid" ? "border-ink bg-ink text-cream" : "border-ink/30 text-ink"
                    }`}
                  >
                    <span className="absolute -top-2.5 right-2 bg-tan-gold px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.03em] text-ink">
                      Free Shipping
                    </span>
                    <span className="block font-bold uppercase tracking-[0.03em]">Prepaid</span>
                    <span className="block text-caption opacity-80">Free shipping, pay ₹{total.toLocaleString("en-IN")} now</span>
                  </button>
                  <button
                    type="button"
                    disabled={codUnavailable}
                    onClick={() => setPaymentType("cod_advance")}
                    className={`flex-1 border px-4 py-2.5 text-left font-sans text-body-s transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
                      paymentType === "cod_advance" ? "border-ink bg-ink text-cream" : "border-ink/30 text-ink"
                    }`}
                  >
                    <span className="block font-bold uppercase tracking-[0.03em]">Cash On Delivery</span>
                    <span className="block text-caption opacity-80">
                      {codUnavailable
                        ? "Not available for this pincode — prepaid only"
                        : `Pay ₹${razorpay.codAdvanceRupees.toLocaleString("en-IN")} now, rest on delivery`}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {postBarter.enabled && (
              <div className="mt-6 border border-divider p-4">
                <button
                  type="button"
                  onClick={() => setPaymentType(paymentType === "post_barter" ? "prepaid" : "post_barter")}
                  className={`w-full border px-4 py-2.5 text-left font-sans text-body-s transition-colors duration-200 ${
                    paymentType === "post_barter" ? "border-ink bg-ink text-cream" : "border-ink/30 text-ink"
                  }`}
                >
                  <span className="block font-bold uppercase tracking-[0.03em]">
                    Skip Payment — <PayWithAPostMark />
                  </span>
                  <span className="block text-caption opacity-80">
                    Post about us on Instagram instead of paying — one item per order.
                  </span>
                </button>

                {paymentType === "post_barter" && (
                  <div className="mt-4 space-y-3">
                    <div className="flex gap-2">
                      <input
                        value={barterHandle}
                        onChange={(e) => {
                          setBarterHandle(e.target.value);
                          setBarterPreview(null);
                          setOwnershipVerified(false);
                        }}
                        placeholder="Your Instagram handle"
                        className="min-w-0 flex-1 border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s text-ink outline-none placeholder:text-secondary-text focus:border-ink"
                      />
                      <button
                        type="button"
                        onClick={checkBarterTier}
                        disabled={!barterHandle.trim() || barterChecking}
                        className="shrink-0 border border-ink px-4 py-2 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink hover:bg-ink hover:text-cream disabled:opacity-40"
                      >
                        {barterChecking ? "Checking…" : "Check"}
                      </button>
                    </div>

                    {!barterPreview && (
                      <p className="text-caption text-secondary-text">
                        {postBarter.minFollowers.toLocaleString("en-IN")}+ followers ships free right away; under
                        that, we ship once your code drives {postBarter.requiredOrders} sales.
                      </p>
                    )}

                    {barterPreview && (
                      <div className="border border-divider bg-surface-alt p-3 text-caption text-ink">
                        {barterPreview.tier === "gift_first" ? (
                          <p>
                            You&apos;re Gift First —{" "}
                            {barterPreview.followerCount?.toLocaleString("en-IN")} followers. Confirm it&apos;s
                            really you below and we ship right away.
                          </p>
                        ) : (
                          <p>
                            You&apos;re Post First —{" "}
                            {barterPreview.followerCount != null
                              ? `${barterPreview.followerCount.toLocaleString("en-IN")} followers — under ${postBarter.minFollowers.toLocaleString("en-IN")}.`
                              : "we couldn't verify your follower count."}{" "}
                            We ship once your code drives {postBarter.requiredOrders} sales.
                          </p>
                        )}
                      </div>
                    )}

                    {barterPreview?.tier === "gift_first" && barterPreview.verificationCode && !ownershipVerified && (
                      <div className="border border-divider p-3 text-caption text-ink">
                        <p>
                          Add this code to your Instagram bio for a few minutes, then tap Verify:{" "}
                          <code className="border border-ink/30 bg-surface px-2 py-0.5 font-sans tracking-[0.05em]">
                            {barterPreview.verificationCode}
                          </code>
                        </p>
                        <button
                          type="button"
                          onClick={verifyBarterOwnership}
                          className="mt-2 border border-ink px-3 py-1.5 font-sans text-micro font-bold uppercase tracking-[0.05em] text-ink hover:bg-ink hover:text-cream"
                        >
                          Verify
                        </button>
                      </div>
                    )}

                    {barterPreview?.tier === "gift_first" && ownershipVerified && (
                      <label className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={giftFirstTermsAccepted}
                          onChange={(e) => setGiftFirstTermsAccepted(e.target.checked)}
                          className="mt-0.5 h-4 w-4 accent-ink"
                        />
                        <span className="text-caption text-ink">
                          Verified — I&apos;ll post about it after it arrives.
                        </span>
                      </label>
                    )}

                    {barterError && <p className="text-caption text-paint-orange">{barterError}</p>}
                    <p className="text-caption text-secondary-text">
                      <PayWithAPostMark linked /> — One Item Only
                    </p>
                  </div>
                )}
              </div>
            )}

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

            <form onSubmit={handleSubmit} className="mt-10 space-y-4">
              <div>
                <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
                  Full Name
                </label>
                <input
                  required
                  autoComplete="name"
                  value={form.name}
                  onChange={update("name")}
                  className="mt-1.5 w-full border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s text-ink outline-none focus:border-ink"
                />
              </div>

              <div>
                <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
                  Phone
                </label>
                <input
                  required
                  type="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={update("phone")}
                  className="mt-1.5 w-full border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s text-ink outline-none focus:border-ink"
                />
              </div>

              <div>
                <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={update("email")}
                  className="mt-1.5 w-full border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s text-ink outline-none focus:border-ink"
                />
              </div>

              <div>
                <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
                  Delivery Address
                </label>
                <textarea
                  required
                  rows={3}
                  autoComplete="address-line1"
                  placeholder="House/flat, street, area"
                  value={form.address}
                  onChange={update("address")}
                  className="mt-1.5 w-full border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s text-ink outline-none placeholder:text-secondary-text focus:border-ink"
                />
              </div>

              <div>
                <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
                  Pincode
                </label>
                <input
                  required
                  inputMode="numeric"
                  autoComplete="postal-code"
                  maxLength={6}
                  value={form.pincode}
                  onChange={update("pincode")}
                  className="mt-1.5 w-full max-w-[120px] border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s text-ink outline-none focus:border-ink"
                />
                <p className="mt-1.5 text-caption text-secondary-text">We&apos;ll fill in your city and state automatically.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
                    City
                  </label>
                  <input
                    required
                    autoComplete="address-level2"
                    value={form.city}
                    onChange={update("city")}
                    className="mt-1.5 w-full border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s text-ink outline-none focus:border-ink"
                  />
                </div>
                <div>
                  <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
                    State
                  </label>
                  <input
                    required
                    autoComplete="address-level1"
                    value={form.state}
                    onChange={update("state")}
                    className="mt-1.5 w-full border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s text-ink outline-none focus:border-ink"
                  />
                </div>
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
                    className="mt-4 w-full border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s text-ink outline-none placeholder:text-secondary-text focus:border-ink"
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
                disabled={
                  paying ||
                  (paymentType !== "post_barter" && shippingBlocking) ||
                  !configLoaded ||
                  (paymentType === "post_barter" && (!barterHandle.trim() || barterSubmitting))
                }
                className="w-full border border-ink bg-ink px-8 py-4 font-sans text-body-s font-bold uppercase tracking-[0.1em] text-cream transition-colors duration-300 hover:bg-cream hover:text-ink disabled:opacity-60"
              >
                {!configLoaded
                  ? "Loading..."
                  : paymentType === "post_barter"
                    ? barterSubmitting
                      ? "Confirming…"
                      : "Confirm — Pay With A Post"
                    : shippingBlocking
                      ? "Undeliverable Pincode"
                      : razorpay.enabled
                        ? paying
                          ? "Processing..."
                          : paymentType === "cod_advance"
                            ? `Pay ₹${Math.min(razorpay.codAdvanceRupees, total).toLocaleString("en-IN")} Now`
                            : `Pay ₹${total.toLocaleString("en-IN")}`
                        : "Place Order via WhatsApp"}
              </button>

              <div className="grid grid-cols-1 gap-4 border-t border-divider pt-6 sm:grid-cols-2">
                <div>
                  <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
                    Referral Code (Optional)
                  </label>
                  <input
                    value={referralCodeInput}
                    onChange={(e) => updateReferralCode(e.target.value)}
                    placeholder="From a friend?"
                    className="mt-1.5 w-full border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s uppercase text-ink outline-none placeholder:normal-case placeholder:text-caption placeholder:text-secondary-text focus:border-ink"
                  />
                  {normalizedReferralCode && (
                    <p className="mt-2 text-caption">
                      {referralChecking ? (
                        <span className="text-secondary-text">Checking code...</span>
                      ) : referralPreview?.checked === normalizedReferralCode && referralPreview.valid ? (
                        <span className="text-tan-gold">
                          Code applied — ₹{referralDiscount.toLocaleString("en-IN")} off
                        </span>
                      ) : referralPreview?.checked === normalizedReferralCode ? (
                        <span className="text-paint-orange">That code isn&apos;t valid for this order.</span>
                      ) : null}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
                    Coupon Code (Optional)
                  </label>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <input
                      value={couponCodeInput}
                      onChange={(e) => setCouponCodeInput(e.target.value)}
                      placeholder="Enter code"
                      className="min-w-0 flex-1 border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s uppercase text-ink outline-none placeholder:normal-case placeholder:text-caption placeholder:text-secondary-text focus:border-ink"
                    />
                    <button
                      type="button"
                      onClick={applyCoupon}
                      disabled={!normalizedCouponCode || couponChecking}
                      className="shrink-0 border border-ink/30 px-3 py-2 font-sans text-caption uppercase tracking-[0.05em] text-ink hover:border-ink disabled:opacity-40"
                    >
                      {couponChecking ? "..." : "Apply"}
                    </button>
                  </div>
                  {normalizedCouponCode && couponPreview?.checked === normalizedCouponCode && (
                    <p className="mt-2 text-caption">
                      {couponPreview.valid ? (
                        <span className="text-tan-gold">Code applied — ₹{couponDiscount.toLocaleString("en-IN")} off</span>
                      ) : (
                        <span className="text-paint-orange">That code isn&apos;t valid for this order.</span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            </form>
          </>
        )}
      </main>

      {razorpay.enabled && <Script src="https://checkout.razorpay.com/v1/checkout.js" />}

      <FooterEditorial />
    </>
  );
}
