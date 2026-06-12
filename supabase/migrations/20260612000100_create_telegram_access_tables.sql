-- Telegram based access system for Analisa Angka
-- Rule utama: 1 telegram_user_id hanya boleh memakai trial 1 kali.

create extension if not exists pgcrypto;

create table if not exists public.telegram_users (
  id uuid primary key default gen_random_uuid(),

  telegram_user_id bigint not null unique,
  chat_id bigint,
  telegram_username text,
  telegram_first_name text,
  telegram_last_name text,
  telegram_language_code text,

  plan text not null default 'NONE'
    check (plan in ('NONE', 'TRIAL', 'PRO')),

  trial_used boolean not null default false,
  trial_started_at timestamptz,
  trial_expires_at timestamptz,

  pro_started_at timestamptz,
  pro_expires_at timestamptz,

  is_active boolean not null default true,
  suspended_at timestamptz,
  suspended_reason text,

  active_session_id uuid,
  active_session_at timestamptz,

  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint telegram_users_trial_dates_check check (
    (trial_started_at is null and trial_expires_at is null)
    or
    (trial_started_at is not null and trial_expires_at is not null and trial_expires_at > trial_started_at)
  ),

  constraint telegram_users_pro_dates_check check (
    (pro_started_at is null and pro_expires_at is null)
    or
    (pro_started_at is not null and pro_expires_at is not null and pro_expires_at > pro_started_at)
  )
);

create index if not exists telegram_users_plan_idx
  on public.telegram_users (plan);

create index if not exists telegram_users_trial_used_idx
  on public.telegram_users (trial_used);

create index if not exists telegram_users_pro_expires_at_idx
  on public.telegram_users (pro_expires_at);

create table if not exists public.telegram_login_codes (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references public.telegram_users(id) on delete cascade,
  telegram_user_id bigint not null,
  chat_id bigint,

  code_hash text not null unique,
  code_type text not null default 'LOGIN'
    check (code_type in ('LOGIN', 'TRIAL_LOGIN', 'PRO_LOGIN')),

  expires_at timestamptz not null,
  used_at timestamptz,
  consumed_session_id uuid,

  request_ip_hash text,
  request_user_agent_hash text,

  created_at timestamptz not null default now(),

  constraint telegram_login_codes_expiry_check check (expires_at > created_at),
  constraint telegram_login_codes_user_match_fk foreign key (telegram_user_id)
    references public.telegram_users(telegram_user_id) on delete cascade
);

create index if not exists telegram_login_codes_user_id_idx
  on public.telegram_login_codes (user_id);

create index if not exists telegram_login_codes_telegram_user_id_idx
  on public.telegram_login_codes (telegram_user_id);

create index if not exists telegram_login_codes_expires_at_idx
  on public.telegram_login_codes (expires_at);

create index if not exists telegram_login_codes_unused_idx
  on public.telegram_login_codes (used_at)
  where used_at is null;

create table if not exists public.telegram_access_events (
  id uuid primary key default gen_random_uuid(),

  user_id uuid references public.telegram_users(id) on delete set null,
  telegram_user_id bigint,
  chat_id bigint,

  event_type text not null,
  event_detail text,
  metadata jsonb not null default '{}'::jsonb,

  ip_hash text,
  user_agent_hash text,

  created_at timestamptz not null default now()
);

create index if not exists telegram_access_events_user_id_idx
  on public.telegram_access_events (user_id);

create index if not exists telegram_access_events_telegram_user_id_idx
  on public.telegram_access_events (telegram_user_id);

create index if not exists telegram_access_events_event_type_idx
  on public.telegram_access_events (event_type);

create index if not exists telegram_access_events_created_at_idx
  on public.telegram_access_events (created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists telegram_users_set_updated_at on public.telegram_users;
create trigger telegram_users_set_updated_at
before update on public.telegram_users
for each row
execute function public.set_updated_at();

alter table public.telegram_users enable row level security;
alter table public.telegram_login_codes enable row level security;
alter table public.telegram_access_events enable row level security;

-- Tidak dibuat policy untuk anon/auth.
-- Akses tabel ini hanya boleh dari server memakai Supabase service role key.
