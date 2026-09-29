"use client";

import React, { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Copy, ArrowLeft, MessageCircle, ShieldCheck, Zap } from "lucide-react";

function UpiPayContent() {
  const searchParams = useSearchParams();
  const rawAmount = searchParams.get("am") || "1399";
  const items = searchParams.get("item") || searchParams.get("items") || "Travaholic Cap";
  const [copied, setCopied] = useState(false);

  // Normalize amount to a clean integer
  const amount = parseInt(rawAmount.replace(/\D/g, ""), 10) || 1399;
  const formattedAmount = amount.toLocaleString("en-IN");

  const upiId = searchParams.get("vpa") || "viratmohan-1@okhdfcbank";
  const payeeName = searchParams.get("pn") || "Travaholic Caps";
  const note = `Travaholic Order (${items.slice(0, 30)})`;

  // Standard NPCI UPI URI
  const upiUri = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(upiUri)}`;

  useEffect(() => {
    // Attempt auto-launch UPI app on mobile devices after slight delay
    if (typeof window !== "undefined") {
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isMobile) {
        const timer = setTimeout(() => {
          window.location.href = upiUri;
        }, 400);
        return () => clearTimeout(timer);
      }
    }
  }, [upiUri]);

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(upiId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-between px-4 py-8 antialiased selection:bg-amber-500 selection:text-black">
      {/* Header */}
      <header className="max-w-md mx-auto w-full flex items-center justify-between py-2 border-b border-neutral-900 mb-6">
        <a
          href="https://www.travaholic.in"
          className="text-xs uppercase tracking-widest font-mono text-neutral-400 hover:text-white flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Travaholic
        </a>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-emerald-400">
          <ShieldCheck className="w-3 h-3" />
          Direct UPI
        </span>
      </header>

      {/* Main Card */}
      <main className="max-w-md mx-auto w-full bg-neutral-900/70 border border-neutral-800/80 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center space-y-2 mb-6">
          <p className="text-xs uppercase tracking-widest font-mono text-neutral-400">Total Payable</p>
          <div className="text-4xl sm:text-5xl font-black tracking-tight text-white flex items-center justify-center gap-1">
            <span>₹</span>
            <span>{formattedAmount}</span>
          </div>
          <p className="text-xs text-neutral-400 font-medium flex items-center justify-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Free Express Shipping Included
          </p>
        </div>

        {/* 1-Tap Pay Button */}
        <div className="space-y-3 mb-6">
          <a
            href={upiUri}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-neutral-950 font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 hover:scale-[1.01] active:scale-[0.99] transition-all text-center"
          >
            <span>Pay ₹{formattedAmount} via UPI App</span>
          </a>
          <p className="text-[11px] text-center text-neutral-500 font-mono">
            Supported: Google Pay • PhonePe • Paytm • BHIM • CRED
          </p>
        </div>

        {/* Dynamic QR Code */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 mb-6 text-center space-y-3">
          <p className="text-xs font-mono uppercase tracking-wider text-neutral-400">
            Or Scan QR with Any UPI App
          </p>
          <div className="inline-block p-2 bg-white rounded-xl shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrCodeUrl}
              alt={`UPI QR Code for ₹${formattedAmount}`}
              width={220}
              height={220}
              className="w-48 h-48 sm:w-52 sm:h-52 object-contain"
            />
          </div>
          <p className="text-[11px] text-neutral-500">
            Amount is locked to exact cart total
          </p>
        </div>

        {/* UPI ID Copy Box */}
        <div className="bg-neutral-950/70 border border-neutral-800/80 rounded-xl p-3.5 mb-6 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase font-mono tracking-wider text-neutral-500">
              Payee UPI ID
            </p>
            <p className="font-mono text-sm text-neutral-200 truncate">{upiId}</p>
          </div>
          <button
            onClick={handleCopy}
            type="button"
            className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-mono text-white flex items-center gap-1.5 transition-colors shrink-0"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy
              </>
            )}
          </button>
        </div>

        {/* Next Steps Card */}
        <div className="border-t border-neutral-800/80 pt-5 space-y-3">
          <div className="flex items-start gap-2.5 text-xs text-neutral-300">
            <span className="w-5 h-5 rounded-full bg-neutral-800 text-amber-400 flex items-center justify-center text-[10px] font-mono shrink-0 mt-0.5">
              1
            </span>
            <span>Complete the payment of <strong>₹{formattedAmount}</strong> using any UPI app.</span>
          </div>
          <div className="flex items-start gap-2.5 text-xs text-neutral-300">
            <span className="w-5 h-5 rounded-full bg-neutral-800 text-amber-400 flex items-center justify-center text-[10px] font-mono shrink-0 mt-0.5">
              2
            </span>
            <span>Take a screenshot of the successful payment screen.</span>
          </div>
          <div className="flex items-start gap-2.5 text-xs text-neutral-300">
            <span className="w-5 h-5 rounded-full bg-neutral-800 text-amber-400 flex items-center justify-center text-[10px] font-mono shrink-0 mt-0.5">
              3
            </span>
            <span>Send the screenshot & delivery address on WhatsApp to dispatch your cap!</span>
          </div>

          <a
            href="https://wa.me/918800339125?text=Hi%2C+I+have+completed+the+payment+for+my+Travaholic+order"
            className="w-full mt-4 py-3 px-4 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 font-semibold text-xs flex items-center justify-center gap-2 transition-all"
          >
            <MessageCircle className="w-4 h-4" />
            Send Screenshot on WhatsApp (8800339125)
          </a>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-md mx-auto w-full text-center py-6 text-neutral-600 text-[11px] font-mono space-y-1">
        <p>Travaholic Caps • Direct Peer Settlement</p>
        <p>0% Transaction Fees • Safe & Encrypted NPCI UPI</p>
      </footer>
    </div>
  );
}

export default function UpiPayPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
          <p className="font-mono text-sm text-neutral-400 animate-pulse">Loading secure checkout...</p>
        </div>
      }
    >
      <UpiPayContent />
    </Suspense>
  );
}
