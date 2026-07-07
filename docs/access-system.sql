-- Analisa Angka PIN access system
-- Jalankan di Supabase SQL Editor sebelum deploy branch ini.

create extension if not exists pgcrypto;

create table if not exists public.access_pins (
  id uuid primary key default gen_random_uuid(),
  pin_hash text not null unique,
  status text not null default 'unused' check (status in ('unused', 'used', 'revoked')),
  note text,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  revoked_at timestamptz,
  used_session_id uuid
);

create table if not exists public.access_sessions (
  id uuid primary key default gen_random_uuid(),
  pin_id uuid references public.access_pins(id) on delete set null,
  session_token_hash text not null unique,
  device_id text,
  device_name text,
  user_agent text,
  ip_hash text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'access_pins_used_session_id_fkey'
  ) then
    alter table public.access_pins
      add constraint access_pins_used_session_id_fkey
      foreign key (used_session_id)
      references public.access_sessions(id)
      on delete set null;
  end if;
end $$;

create index if not exists access_pins_status_created_idx
  on public.access_pins(status, created_at desc);

create index if not exists access_sessions_revoked_last_seen_idx
  on public.access_sessions(revoked_at, last_seen_at desc);

create or replace view public.admin_access_pins_view as
select
  p.id,
  p.status,
  p.note,
  p.created_at,
  p.used_at,
  p.revoked_at,
  p.used_session_id,
  s.device_name,
  s.device_id,
  s.created_at as session_created_at,
  s.last_seen_at,
  s.revoked_at as session_revoked_at
from public.access_pins p
left join public.access_sessions s on s.id = p.used_session_id
order by p.created_at desc;

create or replace view public.admin_access_sessions_view as
select
  s.id,
  s.pin_id,
  s.device_id,
  s.device_name,
  s.user_agent,
  s.created_at,
  s.last_seen_at,
  s.revoked_at,
  s.revoked_reason,
  case when s.revoked_at is null then 'active' else 'revoked' end as status,
  p.note as pin_note
from public.access_sessions s
left join public.access_pins p on p.id = s.pin_id
order by s.created_at desc;

alter table public.access_pins enable row level security;
alter table public.access_sessions enable row level security;

-- Tidak perlu policy anon. Aplikasi membaca/menulis tabel akses memakai service role di route server.
