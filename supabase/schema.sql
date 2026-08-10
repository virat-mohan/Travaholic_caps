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
