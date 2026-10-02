-- Every contact-form submission, real or dropped as spam, so spam is
-- auditable and the per-IP rate limit (3 per 10 minutes) works across
-- serverless instances. ip_hash is a SHA-256 of the IP, never the raw IP.
create table if not exists contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  message text,
  ip_hash text,
  is_spam boolean not null default false,
  spam_reason text,
  created_at timestamptz not null default now()
);
create index if not exists contact_submissions_ip_idx on contact_submissions (ip_hash, created_at);
alter table contact_submissions enable row level security;
