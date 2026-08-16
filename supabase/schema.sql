-- Run this once in the Supabase SQL editor (Project -> SQL Editor -> New query).

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  customer_name text not null,
  customer_phone text not null,
  customer_email text not null,
  delivery_address text not null,
  subtotal integer not null, -- in INR, whole rupees, before discount
  discount_amount integer not null default 0,
  total integer not null default 0, -- subtotal - discount_amount
  status text not null default 'pending_whatsapp_confirmation',
  -- Fulfilment. shiprocket_order_id gets filled in once that integration exists.
  shipment_status text not null default 'not_shipped',
  shiprocket_order_id text,
  refund_status text not null default 'none', -- none | requested | approved | refunded | denied
  is_gift boolean not null default false,
  gift_note text
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  chapter_slug text not null,
  chapter_name text not null,
  unit_price integer not null,
  quantity integer not null
);

create index if not exists order_items_order_id_idx on order_items (order_id);

-- Inventory: one row per Chapter. stock_on_hand is decremented on sale and can be
-- bumped up manually from the admin when new stock arrives.
create table if not exists inventory (
  chapter_slug text primary key,
  stock_on_hand integer not null default 0,
  updated_at timestamptz not null default now()
);

insert into inventory (chapter_slug, stock_on_hand) values
  ('travaholic-black', 110),
  ('travaholic-ocean', 60),
  ('travaholic-sky', 67),
  ('sunshine', 10),
  ('tropical-blue', 33),
  ('tropical-pink', 83),
  ('dunes-maroon', 10),
  ('dunes-yellow', 0),
  ('beachn', 94),
  ('travaholic-orange', 11),
  ('peaking', 13),
  ('wildling', 86),
  ('junglee', 96),
  ('city-slicker-black', 34)
on conflict (chapter_slug) do update set stock_on_hand = excluded.stock_on_hand;

-- Not yet seeded — no matching chapter slug found for these when the stock sheet
-- came in. Confirm with the client which chapter each belongs to, then either
-- rename an existing slug's row above or insert a new one:
--   'City Slicker Burgundy' — 54 units
--   'Travaholic White' — 31 units
-- Also missing entirely from the stock sheet: 'city-slicker' (City Slicker Black/Grey).

-- Discount rules: simple "buy N, cheapest one at X% off" promos (e.g. buy 2 get
-- 3rd at half price = buy_quantity 3, discount_percent 50). Only one should be
-- active at a time — the app just takes the first active row it finds.
create table if not exists discount_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  buy_quantity integer not null,
  discount_percent integer not null,
  active boolean not null default false,
  created_at timestamptz not null default now()
);

insert into discount_rules (name, buy_quantity, discount_percent, active) values
  ('Buy 2, get 3rd at half price', 3, 50, true);

-- Chapters added from the admin (the original 16 stay hardcoded in lib/chapters.ts —
-- this table is only for new ones added later, and their images live in Supabase
-- Storage's "chapter-images" bucket rather than public/images/chapters).
create table if not exists dynamic_chapters (
  slug text primary key,
  name text not null,
  series text not null,
  story text not null,
  price integer not null default 1399,
  verified_on_site boolean not null default true,
  images text[] not null default '{}', -- full Storage URLs
  primary_image text not null,
  created_at timestamptz not null default now()
);

-- Per-chapter edits from /admin/edit-chapter — works for BOTH the static 16
-- and dynamic_chapters rows. Any column left null means "use the hardcoded
-- value" for that field. primary_image is either one of that chapter's
-- existing filenames (static) or a full Storage URL (dynamic).
create table if not exists chapter_hero_overrides (
  chapter_slug text primary key,
  primary_image text,
  price integer,
  story text,
  updated_at timestamptz not null default now()
);

-- Simple key/value store for admin-entered settings (e.g. Razorpay keys)
-- that need to be readable server-side without redeploying env vars.
create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- Razorpay/payment fields on an already-existing orders table (safe to
-- re-run — these are no-ops once applied).
alter table orders add column if not exists payment_status text not null default 'unpaid';
alter table orders add column if not exists razorpay_order_id text;
alter table orders add column if not exists razorpay_payment_id text;

-- Claude-generated Journal article drafts from /admin/journal-drafts. These
-- are NOT auto-published — the live Journal is still the static list in
-- lib/journal.ts, so a draft has to be copied in by hand once it's approved.
create table if not exists journal_drafts (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  title text,
  subtitle text,
  category text,
  excerpt text,
  body text[],
  status text not null default 'draft', -- draft | ready | archived
  created_at timestamptz not null default now()
);

-- Claude-generated ad copy + creative brief for a Chapter, from
-- /admin/ad-briefs. image_url is either an AI-generated image (via Gemini,
-- stored in the ad-creatives Storage bucket) or a real photo picked from
-- marketing_assets/chapter images — image_source tells you which.
-- Approving a brief creates a PAUSED Meta campaign/adset/ad; nothing ever
-- goes live without a human flipping it on in Meta Ads Manager.
create table if not exists ad_briefs (
  id uuid primary key default gen_random_uuid(),
  chapter_slug text,
  headline text,
  primary_text text,
  cta text,
  target_audience text,
  image_prompt text,
  image_url text,
  image_source text, -- generated | real
  status text not null default 'draft', -- draft | approved | launched | rejected
  meta_campaign_id text,
  meta_adset_id text,
  meta_ad_id text,
  created_at timestamptz not null default now()
);

-- Submissions from /community/add-your-chapter. Pending until an admin
-- approves them in /admin/explorer-submissions — only then do they show up
-- on the live Explorers wall (merged with the static filesystem-backed
-- photos in lib/community.ts) and, best-effort, get posted as an Instagram
-- Story.
create table if not exists explorer_submissions (
  id uuid primary key default gen_random_uuid(),
  photo_url text not null,
  testimonial text not null,
  location text,
  email text,
  chapter_slugs text[] not null default '{}',
  status text not null default 'pending', -- pending | approved | rejected
  instagram_posted boolean not null default false,
  created_at timestamptz not null default now()
);

-- Real product/lifestyle photos the admin uploads on purpose, to be used as
-- ad creatives directly (skip generation entirely) or as reference images fed
-- into image-gen for compositing — keeps ad creative costs down and grounded
-- in real photography rather than always generating from scratch.
create table if not exists marketing_assets (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  label text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- One row per anonymous shopper's cart, keyed by a client-generated
-- session_key stored alongside the cart in localStorage. Contact fields fill
-- in as soon as the shopper types them at checkout — that's what makes an
-- "abandoned cart" retargetable at all, since the cart itself is anonymous
-- until then. /api/cron/abandon-sweep flips 'active' rows stale for 45+
-- minutes to 'abandoned' and triggers a WhatsApp nudge; the Razorpay/WhatsApp
-- order routes flip a session to 'converted' the moment it becomes a real
-- order.
create table if not exists cart_sessions (
  id uuid primary key default gen_random_uuid(),
  session_key text unique not null,
  customer_name text,
  customer_phone text,
  customer_email text,
  items jsonb not null default '[]',
  subtotal integer,
  status text not null default 'active', -- active | converted | abandoned
  retargeted_at timestamptz,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- First-party funnel log — deliberately NOT dependent on Meta's pixel or any
-- third-party analytics being configured. This is what /admin/reports reads
-- to compute the funnel (views -> add to cart -> checkout -> purchase);
-- ad spend/clicks get joined in separately from Meta's own Insights API only
-- when Meta keys exist. event_name mirrors the standard Meta/GA4 vocabulary
-- (PageView, ViewContent, AddToCart, InitiateCheckout, Purchase) so wiring in
-- a second ad platform later is additive, not a rewrite.
create table if not exists tracking_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  session_key text,
  chapter_slug text,
  value integer,
  created_at timestamptz not null default now()
);
create index if not exists tracking_events_created_at_idx on tracking_events (created_at);

-- One row per WhatsApp send (order confirmation OR abandoned-cart retarget),
-- so /admin/reports can show open rate (delivered/read, via the MSG91
-- webhook) and conversion rate (converted, flipped by the order routes
-- when the linked cart_session becomes a real order) — not just "message
-- sent." interakt_message_id is a leftover from before MSG91 fully replaced
-- Interakt; harmless to keep, always null on new rows.
create table if not exists whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  cart_session_id uuid references cart_sessions (id),
  order_id uuid references orders (id),
  interakt_message_id text,
  msg91_message_id text,
  provider text not null default 'msg91',
  template_name text not null,
  status text not null default 'sent', -- sent | delivered | read | failed
  sent_at timestamptz not null default now(),
  delivered_at timestamptz,
  read_at timestamptz,
  converted boolean not null default false
);

-- Weekly ROAS snapshots, generated on demand from /admin/reports (or by the
-- weekly cron once Vercel cron is available on your plan). Stored so the
-- report has history instead of only ever showing "right now."
create table if not exists weekly_reports (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  week_end date not null,
  ad_spend integer not null default 0,
  clicks integer not null default 0,
  impressions integer not null default 0,
  page_views integer not null default 0,
  add_to_carts integer not null default 0,
  checkouts_started integer not null default 0,
  orders_count integer not null default 0,
  revenue integer not null default 0,
  abandoned_carts integer not null default 0,
  roas numeric,
  created_at timestamptz not null default now()
);

-- Meta campaign/reel state on an ad_brief, plus the running audit log of
-- every autonomous action the ad agent takes on it.
alter table ad_briefs add column if not exists video_status text; -- none | generating | ready | failed
alter table ad_briefs add column if not exists video_operation_name text;
alter table ad_briefs add column if not exists video_url text;

-- Every action the ad agent takes (or explicitly declines to take) on a
-- launched campaign, with before/after values — this table IS the safety
-- mechanism for letting an agent touch ad spend at all. Read it before you
-- ever trust an autonomous action; it's designed to make second-guessing the
-- agent trivial.
create table if not exists agent_actions (
  id uuid primary key default gen_random_uuid(),
  ad_brief_id uuid references ad_briefs (id),
  action text not null, -- paused | budget_increased | budget_decreased | no_action
  reason text not null,
  before_value text,
  after_value text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Customer accounts: phone + OTP login, saved addresses, and a
-- Travaholic Miles loyalty ledger.
-- ============================================================

-- One row per real customer, identified by phone and/or email — only one is
-- required at login, not both (checkout collects a phone/address separately
-- on every order regardless of account, so this never blocks shipping).
-- Created the first time someone verifies an OTP — there's no separate
-- signup step.
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  phone text unique not null,
  name text,
  email text,
  newsletter_subscribed boolean not null default true,
  created_at timestamptz not null default now()
);
-- phone used to be mandatory; email-only accounts are now allowed, so the
-- NOT NULL + plain UNIQUE from the original CREATE TABLE have to be relaxed
-- via ALTER (existing table, so the CREATE TABLE column list alone won't
-- take effect — same lesson as otp_codes.email above).
alter table customers alter column phone drop not null;
alter table customers drop constraint if exists customers_phone_key;
create unique index if not exists customers_phone_unique_idx on customers (phone) where phone is not null;
create unique index if not exists customers_email_unique_idx on customers (email) where email is not null;

-- Short-lived one-time codes for login. A row can key off phone, email, or
-- both — whichever the requester provided at least one of.
create table if not exists otp_codes (
  id uuid primary key default gen_random_uuid(),
  phone text,
  code text not null,
  expires_at timestamptz not null,
  consumed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists otp_codes_phone_idx on otp_codes (phone);
alter table otp_codes alter column phone drop not null;
-- Delivery channel while WhatsApp/SMS is still being set up. Added after
-- otp_codes already existed in production, so this has to be a separate
-- ALTER — CREATE TABLE IF NOT EXISTS is a no-op once the table is there,
-- it won't retroactively add columns.
alter table otp_codes add column if not exists email text;

-- Opaque bearer tokens set as an httpOnly cookie after OTP verification —
-- deliberately not a JWT, so a session can be revoked by deleting one row
-- instead of waiting out an expiry.
create table if not exists customer_sessions (
  token text primary key,
  customer_id uuid not null references customers (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers (id) on delete cascade,
  label text,
  recipient_name text not null,
  phone text not null,
  address_line text not null,
  city text,
  state text,
  pincode text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- Every Miles movement, positive (earned on a purchase) or negative
-- (redeemed at checkout) — balance is always sum(delta), never stored
-- directly, so it can't drift out of sync with what actually happened.
create table if not exists loyalty_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers (id) on delete cascade,
  delta integer not null,
  reason text not null,
  order_id uuid references orders (id),
  created_at timestamptz not null default now()
);
create index if not exists loyalty_ledger_customer_idx on loyalty_ledger (customer_id);

alter table orders add column if not exists customer_id uuid references customers (id);
alter table orders add column if not exists loyalty_discount_amount integer not null default 0;

-- ============================================================
-- Newsletter: guest signups (footer form) plus logged-in customers who
-- opted in — /admin/newsletter sends new Journal articles to the union of
-- both, deduplicated by email.
-- ============================================================

create table if not exists newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  subscribed_at timestamptz not null default now()
);

-- One row per Journal article ever sent, keyed by its static slug from
-- lib/journal.ts — prevents double-sending and is what /admin/newsletter
-- reads to show "sent" vs "not sent yet".
create table if not exists journal_newsletter_sends (
  article_slug text primary key,
  recipient_count integer not null default 0,
  sent_at timestamptz not null default now()
);

-- ============================================================
-- Legacy customer data imported from CSV via /admin/customers. Kept
-- separate from the real `orders` table on purpose — an imported row never
-- touched inventory, discount rules, or payment, so it must never be
-- mistaken for a real order. The customer master view in /admin/customers
-- merges this with real orders at read time, deduplicated by phone.
-- ============================================================
create table if not exists imported_customer_records (
  id uuid primary key default gen_random_uuid(),
  name text,
  phone text,
  email text,
  purchase_date date,
  purchase_value integer,
  quantity integer,
  order_id text, -- the source system's order id, if the export had one (one row per order, not per line item)
  source_file text,
  imported_at timestamptz not null default now()
);
create index if not exists imported_customer_records_phone_idx on imported_customer_records (phone);

-- ============================================================
-- Shiprocket delivery. Structured address fields — Shiprocket's create-order
-- API requires city/state/pincode/country as separate fields, which the
-- original delivery_address free-text blob can't reliably supply. New
-- orders collect these at checkout going forward; older rows are left null
-- and shipping for them has to be created manually in Shiprocket directly.
-- ============================================================
alter table orders add column if not exists delivery_city text;
alter table orders add column if not exists delivery_state text;
alter table orders add column if not exists delivery_pincode text;
alter table orders add column if not exists shiprocket_shipment_id text;
alter table orders add column if not exists shiprocket_awb_code text;
alter table orders add column if not exists courier_name text;

-- ============================================================
-- Ad copy caption + hashtags, generated alongside the rest of an ad brief
-- so nothing gets typed by hand right before a post/ad goes out.
-- ============================================================
alter table ad_briefs add column if not exists hashtags text[];

-- ============================================================
-- CRM: leads captured from the Meta DM/comment bot (and, going forward,
-- other inbound channels) — deliberately separate from `customers`, since a
-- lead hasn't bought anything yet. `source` and `lead_type` are what make
-- this usable for lookalike audiences and retention marketing later:
-- source answers "where did this person come from" (meta_dm, meta_comment,
-- website, ...), lead_type answers "what do they want" (buying,
-- collaborating, general_enquiry). A lead is linked to the real customer
-- row once/if they actually place an order.
-- ============================================================
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  name text,
  phone text,
  email text,
  source text not null, -- meta_dm | meta_comment | website | other
  lead_type text, -- buying | collaborating | general_enquiry
  platform text, -- instagram | facebook, when source is meta_*
  meta_user_id text, -- the sender's PSID/IGSID, for replying again later
  note text, -- free-text enquiry detail, or the chapter they asked about
  status text not null default 'new', -- new | contacted | converted | closed
  converted_customer_id uuid references customers(id),
  created_at timestamptz not null default now()
);
create index if not exists leads_meta_user_id_idx on leads (meta_user_id);
create index if not exists leads_status_idx on leads (status);

-- ============================================================
-- Meta DM bot conversation state — one row per (platform, sender), tracking
-- where they are in the "what's your name -> phone/email -> buying or
-- enquiring" flow so a reply a minute (or a day) later picks up where it
-- left off instead of restarting the script.
-- ============================================================
create table if not exists bot_conversations (
  id uuid primary key default gen_random_uuid(),
  platform text not null, -- instagram | facebook
  meta_user_id text not null,
  state text not null default 'greeting', -- greeting | awaiting_intent | awaiting_chapter | awaiting_contact | done
  profile_name text,
  intent text, -- buying | collaborating | general_enquiry
  chapter_slug text,
  collected_phone text,
  collected_email text,
  lead_id uuid references leads(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index if not exists bot_conversations_platform_user_idx on bot_conversations (platform, meta_user_id);

-- ============================================================
-- Shipping is a live cost pass-through from Shiprocket's rate-check API
-- (by delivery pincode + package weight), computed server-side and stored
-- alongside the order it was charged on.
-- ============================================================
alter table orders add column if not exists shipping_charge integer not null default 0;

-- ============================================================
-- COD with a mandatory small advance — customer pays a fixed advance
-- (e.g. ₹99) online to confirm the order, courier collects the rest on
-- delivery. This is the RTO-mitigation lever for COD specifically: a
-- shopper who's already put money down is a real commitment, not a free
-- option to refuse at the door, while still offering pay-on-delivery.
-- payment_status stays 'paid' when the advance is what's been collected
-- (in the sense that the order-confirming payment succeeded) — balance_due
-- is what distinguishes "fully settled" from "advance only".
-- ============================================================
alter table orders add column if not exists payment_type text not null default 'prepaid'; -- prepaid | cod_advance
alter table orders add column if not exists cod_advance_amount integer not null default 0;
alter table orders add column if not exists balance_due integer not null default 0;

-- ============================================================
-- Real ad attribution — which specific launched campaign (ad_brief) this
-- order actually traces back to, captured client-side from the `ab` query
-- param a campaign's landing URL carries (see the launch route and
-- lib/client-tracking.ts). This is what turns ROAS from a blended
-- account-wide estimate (weekly_reports.roas) into a true per-campaign
-- number the ad agent can actually trust to scale or pause spend.
-- No FK constraint deliberately — this is client-supplied analytics
-- metadata, not something an order should ever fail to save over; a stale
-- or malformed value just means the order's attribution is unknown, never
-- a reason to lose the order itself.
-- ============================================================
alter table orders add column if not exists attributed_ad_brief_id uuid;
create index if not exists orders_attributed_ad_brief_id_idx on orders (attributed_ad_brief_id);

-- ============================================================
-- "Notify me when back in stock" requests, on a sold-out Chapter's page —
-- reuses the leads table (source: website, lead_type: restock_notify) so
-- this is never a throwaway signup list, it's the same CRM everything else
-- feeds into. chapter_slug is what the inventory update route matches
-- against when stock goes from 0 to positive; status flips new -> contacted
-- once the notification email actually sends, so a lead is never emailed
-- twice for the same restock.
-- ============================================================
alter table leads add column if not exists chapter_slug text;
create index if not exists leads_chapter_slug_idx on leads (chapter_slug);
