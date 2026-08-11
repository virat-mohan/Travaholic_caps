"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Customer = { id: string; phone: string; name: string | null; email: string | null; newsletter_subscribed: boolean };
type Address = {
  id: string;
  label: string | null;
  recipient_name: string;
  phone: string;
  address_line: string;
  city: string | null;
  state: string | null;
  pincode: string | null;
  is_default: boolean;
};
type Order = { id: string; created_at: string; total: number; status: string };
type Loyalty = { balance: number; threshold: number; valueRupees: number; maxRedeemableRupees: number };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function AccountPage() {
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loyalty, setLoyalty] = useState<Loyalty | null>(null);
  const [loading, setLoading] = useState(true);
  const [savedProfile, setSavedProfile] = useState(false);

  const [newAddress, setNewAddress] = useState({
    label: "",
    recipientName: "",
    phone: "",
    addressLine: "",
    city: "",
    state: "",
    pincode: "",
  });
  const [addingAddress, setAddingAddress] = useState(false);

  function load() {
    fetch("/api/account/me")
      .then((res) => res.json())
      .then((data) => {
        if (!data.customer) {
          router.push("/account/login?redirect=/account");
          return;
        }
        setCustomer(data.customer);
        setAddresses(data.addresses ?? []);
        setOrders(data.orders ?? []);
        setLoyalty(data.loyalty);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function updateProfile(patch: Partial<Customer>) {
    if (!customer) return;
    setCustomer({ ...customer, ...patch });
    await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSavedProfile(true);
  }

  async function addAddress(e: React.FormEvent) {
    e.preventDefault();
    setAddingAddress(true);
    try {
      const res = await fetch("/api/account/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAddress),
      });
      if (res.ok) {
        setNewAddress({ label: "", recipientName: "", phone: "", addressLine: "", city: "", state: "", pincode: "" });
        load();
      }
    } finally {
      setAddingAddress(false);
    }
  }

  async function setDefaultAddress(id: string) {
    await fetch("/api/account/addresses", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, setDefault: true }),
    });
    load();
  }

  async function removeAddress(id: string) {
    await fetch("/api/account/addresses", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  async function logOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  if (loading || !customer) {
    return (
      <main className="mx-auto w-full max-w-[700px] px-6 pt-32 pb-24 md:px-12 md:pt-40">
        <p className="text-body-s text-secondary-text">Loading...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[700px] px-6 pt-32 pb-24 md:px-12 md:pt-40">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">Account</p>
          <h1 className="mt-2 font-display text-heading-xl uppercase text-ink md:text-display-m">
            {customer.name || "Your Account"}
          </h1>
        </div>
        <button onClick={logOut} className="text-caption text-secondary-text underline">
          Log Out
        </button>
      </div>

      {loyalty && (
        <div className="mt-10 border border-tan-gold/40 bg-tan-gold/10 p-6">
          <p className="text-caption uppercase tracking-[0.1em] text-secondary-text">Travaholic Miles</p>
          <p className="mt-1 font-display text-heading-l text-ink">{loyalty.balance.toLocaleString("en-IN")}</p>
          <p className="mt-1 text-caption text-secondary-text">
            Every {loyalty.threshold.toLocaleString("en-IN")} Miles = ₹{loyalty.valueRupees.toLocaleString("en-IN")}{" "}
            off. {loyalty.maxRedeemableRupees > 0
              ? `You can redeem ₹${loyalty.maxRedeemableRupees.toLocaleString("en-IN")} right now at checkout.`
              : "Keep buying to unlock your first redemption."}
          </p>
        </div>
      )}

      <section className="mt-12 border-t border-divider pt-8">
        <h2 className="font-display text-heading-s uppercase text-ink">Profile</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
              Name
            </label>
            <input
              defaultValue={customer.name ?? ""}
              onBlur={(e) => updateProfile({ name: e.target.value })}
              className="mt-2 w-full border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s text-ink outline-none focus:border-ink"
            />
          </div>
          <div>
            <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
              Email
            </label>
            <input
              type="email"
              defaultValue={customer.email ?? ""}
              onBlur={(e) => updateProfile({ email: e.target.value })}
              className="mt-2 w-full border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s text-ink outline-none focus:border-ink"
            />
          </div>
          <p className="text-caption text-secondary-text">Phone: {customer.phone}</p>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={customer.newsletter_subscribed}
              onChange={(e) => updateProfile({ newsletter_subscribed: e.target.checked })}
              className="h-4 w-4 accent-ink"
            />
            <span className="font-sans text-body-s text-ink">Send me new Journal stories by email</span>
          </label>
          {savedProfile && <p className="text-caption text-tan-gold">Saved ✓</p>}
        </div>
      </section>

      <section className="mt-12 border-t border-divider pt-8">
        <h2 className="font-display text-heading-s uppercase text-ink">Saved Addresses</h2>
        <div className="mt-4 space-y-4">
          {addresses.map((a) => (
            <div key={a.id} className="flex items-start justify-between gap-4 border border-divider p-4">
              <div>
                {a.is_default && (
                  <span className="text-micro uppercase tracking-[0.05em] text-tan-gold">Default</span>
                )}
                <p className="text-body-s text-ink">
                  {a.recipient_name} · {a.phone}
                </p>
                <p className="text-caption text-secondary-text">{a.address_line}</p>
              </div>
              <div className="flex shrink-0 gap-3">
                {!a.is_default && (
                  <button
                    onClick={() => setDefaultAddress(a.id)}
                    className="text-caption text-secondary-text underline"
                  >
                    Set Default
                  </button>
                )}
                <button onClick={() => removeAddress(a.id)} className="text-caption text-paint-orange underline">
                  Remove
                </button>
              </div>
            </div>
          ))}
          {addresses.length === 0 && (
            <p className="text-body-s text-secondary-text">No saved addresses yet.</p>
          )}
        </div>

        <form onSubmit={addAddress} className="mt-6 space-y-3 border-t border-divider pt-6">
          <p className="text-caption uppercase tracking-[0.1em] text-secondary-text">Add An Address</p>
          <input
            required
            placeholder="Recipient name"
            value={newAddress.recipientName}
            onChange={(e) => setNewAddress((a) => ({ ...a, recipientName: e.target.value }))}
            className="w-full border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s text-ink outline-none placeholder:text-secondary-text focus:border-ink"
          />
          <input
            required
            placeholder="Phone"
            value={newAddress.phone}
            onChange={(e) => setNewAddress((a) => ({ ...a, phone: e.target.value }))}
            className="w-full border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s text-ink outline-none placeholder:text-secondary-text focus:border-ink"
          />
          <textarea
            required
            rows={2}
            placeholder="Address"
            value={newAddress.addressLine}
            onChange={(e) => setNewAddress((a) => ({ ...a, addressLine: e.target.value }))}
            className="w-full border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s text-ink outline-none placeholder:text-secondary-text focus:border-ink"
          />
          <button
            type="submit"
            disabled={addingAddress}
            className="border border-ink px-5 py-2 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink transition-colors duration-300 hover:bg-ink hover:text-cream disabled:opacity-50"
          >
            {addingAddress ? "Adding..." : "Add Address"}
          </button>
        </form>
      </section>

      <section className="mt-12 border-t border-divider pt-8">
        <h2 className="font-display text-heading-s uppercase text-ink">Order History</h2>
        <div className="mt-4 space-y-2">
          {orders.length === 0 ? (
            <p className="text-body-s text-secondary-text">No orders yet.</p>
          ) : (
            orders.map((o) => (
              <div key={o.id} className="flex items-center justify-between text-body-s">
                <span className="text-secondary-text">
                  {formatDate(o.created_at)} · #{o.id.slice(0, 8).toUpperCase()}
                </span>
                <span className="text-ink">₹{o.total.toLocaleString("en-IN")}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
