# Revenue actions for Virat (Travaholic Caps)

Prepared by Nomad, the Travaholic Caps CEO agent, on 2 Oct 2026. Every step here needs your login or your decision, so I haven't done any of it.

## Why
Over the last 7 days, 16 Razorpay payments were started (rows in `pending_orders`) and only 2 were paid. Nearly all traffic comes from Instagram (399 sessions) and Facebook (162), whose in-app browsers often block the Razorpay popup and the hand-off to a UPI app. The fixes I shipped lead with the UPI QR inside those apps. The steps below remove the other blockers.

## 1. Turn on the UPI app buttons (2 minutes)
The checkout can now show GPay, PhonePe and Paytm buttons built from the server's total. They stay hidden until a **business** UPI ID is saved. I didn't add one, because I'm not allowed to set UPI IDs.
1. Open https://www.travaholic.in/admin/settings.
2. Set `BUSINESS_UPI_ID` to the business UPI ID that should receive payments, and `BUSINESS_UPI_NAME` to `Travaholic`.
3. Save. Note: payments made through these buttons go straight to that UPI ID, outside Razorpay, so they're confirmed by hand from the WhatsApp screenshot. The Razorpay QR above them confirms automatically.

## 2. Razorpay webhook secret (5 minutes)
`RAZORPAY_WEBHOOK_SECRET` isn't set, so the webhook (`/api/webhooks/razorpay`) ignores every event. The reconcile sweep covers most of the gap, but instant recovery is off.
1. Go to Razorpay Dashboard → Account & Settings → Webhooks → Add new webhook.
2. URL: `https://www.travaholic.in/api/webhooks/razorpay`. Events: payment.captured, payment.failed, qr_code.credited, payment_link.paid, refund.processed, refund.failed.
3. Choose a secret, then paste the same value into /admin/settings → `RAZORPAY_WEBHOOK_SECRET`.

## 3. Instagram Shop Now and product tags
1. Go to business.facebook.com → Commerce Manager → Create a catalog (E-commerce) in the business that owns @travaholiccaps, or pick the existing one.
2. Catalog → Data sources → Data feed → Scheduled feed. URL: `https://www.travaholic.in/api/product-feed` (the repo already serves it), refreshed daily.
3. Business settings → Users → System users → select the system user whose token the store uses → Assign assets → Catalogs → this catalog → Manage catalog.
4. Commerce Manager → Settings → Business assets → add the Instagram account @travaholiccaps and the Facebook Page, then submit for **Instagram Shopping review** (Commerce eligibility). Review usually takes a few days.
5. Once approved: Instagram app → Settings → Business → Shopping → choose the catalog. You can then tag products on posts and reels, and turn on the Shop button.
6. Send me the catalog ID and I'll save it as a setting, so ads can use content_ids that match it.

## 4. WhatsApp catalog cart
The code path (fd2de1a: a catalog cart sent to the WhatsApp number gets a reply with a `/cart?items=` link) reads correctly, but **no catalog cart has ever reached the inbox** (0 messages). It needs the same catalog connected to the WhatsApp Business number: WhatsApp Manager → Catalog → Connect catalog → choose the catalog from step 3 → turn on "Show catalog" and "Cart". Then send one test cart from your own phone.

## 5. Cron secret
`CRON_SECRET` isn't set, so anyone can call the cron routes (abandon sweep, reconcile). Set it in /admin/settings and update the external scheduler URL to add `?secret=<value>`. This is internal tech-stack work, so it's a fit for Prince if you want to assign it.

## 6. Meta spend (recommendation only; I changed nothing)
The repo stores no Meta spend data. All 37 `ad_briefs` are drafts, and spend is read live from Meta, which I didn't call. What the first-party data shows:
- Ad traffic reaches the cart but not the payment: 16 payments started, 2 paid in 7 days.
- Recommendation: until the new in-app checkout shows a paid rate above 3% for 3 days, hold Meta at the CEO-charter cap. Pause any ad set optimising for link clicks or landing-page views. Move what's left into one Advantage+ Sales / Purchase-optimised ad set.
- Retarget only Website Purchasers and InitiateCheckout 7-day audiences; don't run cold traffic.
- Check in Ads Manager: Columns → Performance → Cost per purchase by ad set, last 7 days. Pause anything with 0 purchases and spend above 2× the average order value (₹1,399).
- Put the saved budget into owned channels: comment-to-DM on every reel, WhatsApp to opted-in past buyers.

## Target (not a fact)
Target: the share of started payments that get paid rises from 2 of 16 (13%) towards 40% within 14 days, measured from `pending_orders` against paid `orders`, and from the new `CheckoutStep` funnel.
