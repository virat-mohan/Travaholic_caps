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
-- so /admin/reports can show open rate (delivered/read, via the Interakt or
-- MSG91 webhook) and conversion rate (converted, flipped by the order routes
-- when the linked cart_session becomes a real order) — not just "message
-- sent." provider distinguishes which webhook a given message_id belongs to.
create table if not exists whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  cart_session_id uuid references cart_sessions (id),
  order_id uuid references orders (id),
  interakt_message_id text,
  msg91_message_id text,
  provider text not null default 'interakt', -- interakt | msg91
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

-- One row per real customer, keyed by phone (the OTP identity). Created the
-- first time someone verifies an OTP — there's no separate signup step.
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  phone text unique not null,
  name text,
  email text,
  newsletter_subscribed boolean not null default true,
  created_at timestamptz not null default now()
);

-- Short-lived one-time codes for phone login. A phone can have several rows
-- over time (one per request) — only the newest unconsumed, unexpired one
-- for that phone is ever valid.
create table if not exists otp_codes (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code text not null,
  expires_at timestamptz not null,
  consumed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists otp_codes_phone_idx on otp_codes (phone);

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
