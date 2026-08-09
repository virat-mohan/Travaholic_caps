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
