begin;

create extension if not exists pgcrypto;
create schema if not exists adaptive;

create table if not exists adaptive.engine_configs (
  id uuid primary key default gen_random_uuid(),
  engine_version text not null,
  config_version text not null,
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (engine_version, config_version)
);

create table if not exists adaptive.result_snapshots (
  id uuid primary key default gen_random_uuid(),
  market_id text not null,
  market_name text not null,
  draw_key text not null,
  result_4d char(4) not null check (result_4d ~ '^[0-9]{4}$'),
  source_sequence integer,
  synced_at timestamptz not null default now(),
  unique (market_id, draw_key)
);

create table if not exists adaptive.engine_states (
  id uuid primary key default gen_random_uuid(),
  market_id text not null,
  target_2d text not null check (target_2d in ('depan', 'tengah', 'belakang')),
  engine_version text not null,
  config_version text not null,
  family_weights jsonb not null default '{}'::jsonb,
  horizon_weights jsonb not null default '{}'::jsonb,
  expert_weights jsonb not null default '{}'::jsonb,
  drift_state text not null default 'stable' check (drift_state in ('stable', 'warning', 'drift', 'recovery')),
  detector_state jsonb not null default '{}'::jsonb,
  last_processed_draw_key text,
  state_revision bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (market_id, target_2d, engine_version, config_version)
);

create table if not exists adaptive.predictions (
  id uuid primary key default gen_random_uuid(),
  market_id text not null,
  market_name text not null,
  target_draw_key text not null,
  target_2d text not null check (target_2d in ('depan', 'tengah', 'belakang')),
  engine_version text not null,
  config_version text not null,
  history_cutoff_key text not null,
  history_length integer not null check (history_length >= 2),
  latest_draw char(4) not null check (latest_draw ~ '^[0-9]{4}$'),
  pair_probabilities real[] not null check (cardinality(pair_probabilities) = 100),
  left_probabilities real[] not null check (cardinality(left_probabilities) = 10),
  right_probabilities real[] not null check (cardinality(right_probabilities) = 10),
  expert_weights jsonb not null default '{}'::jsonb,
  signal_strength text not null check (signal_strength in ('low', 'medium', 'high')),
  drift_state text not null default 'stable' check (drift_state in ('stable', 'warning', 'drift', 'recovery')),
  status text not null default 'pending' check (status in ('pending', 'settled', 'cancelled')),
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  unique (market_id, target_draw_key, target_2d, engine_version, config_version)
);

create table if not exists adaptive.published_selections (
  id uuid primary key default gen_random_uuid(),
  prediction_id uuid not null references adaptive.predictions(id) on delete cascade,
  method text not null check (method in ('ai', 'bbfs')),
  digit_count smallint not null check (digit_count between 1 and 9),
  digits smallint[] not null,
  estimated_success real not null check (estimated_success between 0 and 1),
  baseline_success real not null check (baseline_success between 0 and 1),
  lift real not null,
  selection_margin real not null default 0,
  created_at timestamptz not null default now(),
  check (cardinality(digits) = digit_count),
  unique (prediction_id, method, digit_count)
);

create table if not exists adaptive.evaluations (
  id uuid primary key default gen_random_uuid(),
  prediction_id uuid not null unique references adaptive.predictions(id),
  actual_pair smallint not null check (actual_pair between 0 and 99),
  pair_brier real not null,
  left_brier real not null,
  right_brier real not null,
  combined_loss real not null,
  ai_results jsonb not null default '{}'::jsonb,
  bbfs_results jsonb not null default '{}'::jsonb,
  expert_losses jsonb not null default '{}'::jsonb,
  weights_before jsonb not null default '{}'::jsonb,
  weights_after jsonb not null default '{}'::jsonb,
  drift_before text not null default 'stable',
  drift_after text not null default 'stable',
  created_at timestamptz not null default now()
);

create table if not exists adaptive.drift_events (
  id uuid primary key default gen_random_uuid(),
  market_id text not null,
  target_2d text not null check (target_2d in ('depan', 'tengah', 'belakang')),
  prediction_id uuid references adaptive.predictions(id),
  event_type text not null check (event_type in ('warning', 'drift', 'recovery', 'stable')),
  previous_state text not null,
  next_state text not null,
  detector_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists predictions_market_status_idx
  on adaptive.predictions (market_id, status, created_at desc);
create index if not exists predictions_target_idx
  on adaptive.predictions (market_id, target_2d, created_at desc);
create index if not exists drift_events_market_idx
  on adaptive.drift_events (market_id, target_2d, created_at desc);

create or replace function adaptive.store_prediction(
  p_market_id text,
  p_market_name text,
  p_target_draw_key text,
  p_target_2d text,
  p_engine_version text,
  p_config_version text,
  p_history_cutoff_key text,
  p_history_length integer,
  p_latest_draw text,
  p_pair_probabilities jsonb,
  p_left_probabilities jsonb,
  p_right_probabilities jsonb,
  p_expert_weights jsonb,
  p_signal_strength text,
  p_method text,
  p_digit_count smallint,
  p_digits jsonb,
  p_estimated_success real,
  p_baseline_success real,
  p_lift real,
  p_selection_margin real
) returns uuid
language plpgsql
as $$
declare
  v_prediction_id uuid;
begin
  insert into adaptive.predictions (
    market_id, market_name, target_draw_key, target_2d,
    engine_version, config_version, history_cutoff_key, history_length,
    latest_draw, pair_probabilities, left_probabilities, right_probabilities,
    expert_weights, signal_strength
  ) values (
    p_market_id, p_market_name, p_target_draw_key, p_target_2d,
    p_engine_version, p_config_version, p_history_cutoff_key, p_history_length,
    p_latest_draw,
    array(select value::real from jsonb_array_elements_text(p_pair_probabilities)),
    array(select value::real from jsonb_array_elements_text(p_left_probabilities)),
    array(select value::real from jsonb_array_elements_text(p_right_probabilities)),
    p_expert_weights, p_signal_strength
  )
  on conflict (market_id, target_draw_key, target_2d, engine_version, config_version)
  do update set
    pair_probabilities = excluded.pair_probabilities,
    left_probabilities = excluded.left_probabilities,
    right_probabilities = excluded.right_probabilities,
    expert_weights = excluded.expert_weights,
    signal_strength = excluded.signal_strength
  returning id into v_prediction_id;

  insert into adaptive.published_selections (
    prediction_id, method, digit_count, digits,
    estimated_success, baseline_success, lift, selection_margin
  ) values (
    v_prediction_id, p_method, p_digit_count,
    array(select value::smallint from jsonb_array_elements_text(p_digits)),
    p_estimated_success, p_baseline_success, p_lift, p_selection_margin
  )
  on conflict (prediction_id, method, digit_count)
  do update set
    digits = excluded.digits,
    estimated_success = excluded.estimated_success,
    baseline_success = excluded.baseline_success,
    lift = excluded.lift,
    selection_margin = excluded.selection_margin;

  return v_prediction_id;
end;
$$;

insert into adaptive.engine_configs (engine_version, config_version, config, is_active)
values (
  'hf-apie-v1-foundation',
  '2026-08-04.1',
  '{"status":"foundation","weighting":"family-balanced-equal","horizons":[14,28,56,112],"experts":["positional-frequency","direct-pair-frequency","decayed-pair-frequency","pair-transition"]}'::jsonb,
  true
)
on conflict (engine_version, config_version)
do update set config = excluded.config, is_active = excluded.is_active;

commit;
