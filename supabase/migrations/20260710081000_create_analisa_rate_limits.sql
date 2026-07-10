-- Persistent rate limit storage for PIN/login protection.
-- Run this in Supabase SQL editor or through Supabase migrations.

create table if not exists public.analisa_rate_limits (
  rate_key text primary key,
  failures integer not null default 0 check (failures >= 0),
  reset_at timestamptz not null,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists analisa_rate_limits_locked_until_idx
  on public.analisa_rate_limits (locked_until)
  where locked_until is not null;

create index if not exists analisa_rate_limits_updated_at_idx
  on public.analisa_rate_limits (updated_at);

alter table public.analisa_rate_limits enable row level security;

-- No public RLS policy is created intentionally.
-- Server routes access this table through SUPABASE_SERVICE_ROLE_KEY via createAdminClient().
