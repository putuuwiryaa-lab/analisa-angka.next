begin;

create table if not exists adaptive.reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  trigger text not null
    check (trigger in ('cron', 'manual', 'api')),
  status text not null default 'running'
    check (status in ('running', 'success', 'partial', 'failed')),
  requested_market_id text,
  market_limit integer not null default 4
    check (market_limit between 1 and 50),
  markets_available integer not null default 0
    check (markets_available >= 0),
  markets_planned integer not null default 0
    check (markets_planned >= 0),
  markets_processed integer not null default 0
    check (markets_processed >= 0),
  targets_processed integer not null default 0
    check (targets_processed >= 0),
  full_replay_targets integer not null default 0
    check (full_replay_targets >= 0),
  incremental_targets integer not null default 0
    check (incremental_targets >= 0),
  noop_targets integer not null default 0
    check (noop_targets >= 0),
  settled_predictions integer not null default 0
    check (settled_predictions >= 0),
  error_count integer not null default 0
    check (error_count >= 0),
  remaining_markets integer not null default 0
    check (remaining_markets >= 0),
  details jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists reconciliation_runs_started_idx
  on adaptive.reconciliation_runs (started_at desc);

create index if not exists reconciliation_runs_status_idx
  on adaptive.reconciliation_runs (status, started_at desc);

commit;
