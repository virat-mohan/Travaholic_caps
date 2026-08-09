-- Run this once in the Supabase SQL editor (Project -> SQL Editor -> New query).

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  customer_name text not null,
  customer_phone text not null,
  customer_email text not null,
  delivery_address text not null,
  subtotal integer not null, -- in INR, whole rupees
  status text not null default 'pending_whatsapp_confirmation'
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
