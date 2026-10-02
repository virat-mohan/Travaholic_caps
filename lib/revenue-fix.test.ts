// Money-safety, checkout-step tracking and in-app browser tests.
//   node --experimental-strip-types --test lib/*.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isValidQuantity, assertValidItems, pickSingleDiscount, flooredGoodsTotal,
  amountMatches, toTrackingValue, toCheckoutStepPath,
} from "./money-rules.ts";
import { detectInAppBrowser, openInBrowserUrl, cartDeepLinkPath, buildUpiIntents, whatsappHelpUrl } from "./checkout-browser.ts";

test("quantity must be an integer 1-50", () => {
  for (const q of [1, 2, 50]) assert.ok(isValidQuantity(q));
  for (const q of [0, -1, 51, 1.5, NaN, "2", null]) assert.ok(!isValidQuantity(q));
  assert.throws(() => assertValidItems([{ slug: "a", quantity: 0 }]));
  assert.throws(() => assertValidItems([{ slug: "a", quantity: 2.5 }]));
  assert.throws(() => assertValidItems([]));
  assert.doesNotThrow(() => assertValidItems([{ slug: "a", quantity: 3 }]));
});

test("only one discount applies: the largest", () => {
  const d = pickSingleDiscount({ rule: 1399, loyalty: 100, referral: 200, coupon: 560 });
  assert.equal(d.kind, "rule");
  assert.deepEqual([d.rule, d.loyalty, d.referral, d.coupon], [1399, 0, 0, 0]);
  const c = pickSingleDiscount({ rule: 0, loyalty: 0, referral: 100, coupon: 140 });
  assert.equal(c.kind, "coupon");
  assert.equal(c.referral, 0);
  assert.equal(pickSingleDiscount({ rule: 0, loyalty: 0, referral: 0, coupon: 0 }).kind, null);
});

test("total floored at ₹1, free-reward code may reach ₹0", () => {
  assert.equal(flooredGoodsTotal(1399, 5000, false), 1);
  assert.equal(flooredGoodsTotal(1399, 1399, false), 1);
  assert.equal(flooredGoodsTotal(1399, 1399, true), 0);
  assert.equal(flooredGoodsTotal(1399, 140, false), 1259);
});

test("paid amount must equal trusted total exactly", () => {
  assert.ok(amountMatches(139900, 1399));
  assert.ok(!amountMatches(100, 1399));
  assert.ok(!amountMatches(139999, 1399));
  assert.ok(!amountMatches(NaN, 1399));
});

test("CheckoutStep events always carry an integer value and a /checkout#step path", () => {
  assert.equal(toTrackingValue(1399.5), 1400);
  assert.equal(toTrackingValue("12"), 12);
  assert.equal(toTrackingValue(undefined), undefined);
  assert.equal(toCheckoutStepPath("pay_clicked"), "/checkout#pay_clicked");
  assert.equal(toCheckoutStepPath("rzp_failed_payment timed-out"), "/checkout#rzp_failed_payment_timed_out");
  assert.equal(toCheckoutStepPath(""), null);
  assert.equal(toCheckoutStepPath(42), null);
});

test("detects Instagram and Facebook in-app browsers", () => {
  const ig = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/128 Mobile Instagram 350.0.0";
  const fb = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5) [FBAN/FBIOS;FBAV/470.0]";
  assert.equal(detectInAppBrowser(ig), "instagram");
  assert.equal(detectInAppBrowser(fb), "facebook");
  assert.equal(detectInAppBrowser("Mozilla/5.0 (iPhone) Safari/604.1"), null);
  const url = openInBrowserUrl("https://www.travaholic.in/cart?items=sunshine:1", ig)!;
  assert.match(url, /^intent:\/\/www\.travaholic\.in\/cart\?items=sunshine:1#Intent;scheme=https;package=com\.android\.chrome/);
  assert.equal(openInBrowserUrl("https://www.travaholic.in/cart", fb), null);
  assert.equal(cartDeepLinkPath([{ slug: "sunshine", quantity: 2 }]), "/cart?items=sunshine:2&utm_source=inapp_handoff");
});

test("UPI intents built from the trusted amount, never without a business VPA", () => {
  assert.equal(buildUpiIntents({ vpa: null, payeeName: "T", amountRupees: 1399, ref: "order_1" }), null);
  assert.equal(buildUpiIntents({ vpa: "shop@okaxis", payeeName: "T", amountRupees: 0, ref: "order_1" }), null);
  const u = buildUpiIntents({ vpa: "shop@okaxis", payeeName: "Travaholic", amountRupees: 1399, ref: "order_1" })!;
  assert.match(u.gpay, /^tez:\/\/upi\/pay\?pa=shop%40okaxis&pn=Travaholic&am=1399\.00&cu=INR&tr=order_1/);
  assert.match(u.phonepe, /^phonepe:\/\/pay\?/);
  assert.match(u.paytm, /^paytmmp:\/\/pay\?/);
  assert.match(whatsappHelpUrl("918800339125", ["a", "b"]), /^https:\/\/wa\.me\/918800339125\?text=a%0Ab$/);
});
