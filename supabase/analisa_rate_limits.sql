create table if not exists public.analisa_rate_limits (
  rate_key text primary key,
  failures integer not null default 0,
  reset_at timestamptz not null,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.analisa_rate_limits enable row level security;

create index if not exists analisa_rate_limits_locked_until_idx
  on public.analisa_rate_limits (locked_until)
  where locked_until is not null;

create index if not exists analisa_rate_limits_reset_at_idx
  on public.analisa_rate_limits (reset_at);

comment on table public.analisa_rate_limits is 'Server-side rate limit state for admin login and PIN activation. Accessed only with the Supabase service role.';
