begin;

-- Adaptive V2 config 2026-08-15.1
-- Policy:
-- - WIN tetap membekukan calibration weights selection
-- - MISS memberi loss aksi 0 kepada expert yang hit dan 1 kepada expert yang miss
-- - Brier estimatedSuccess tetap disimpan sebagai calibrationLoss untuk audit,
--   tetapi tidak lagi dipakai sebagai credit assignment antar-expert

do $$
declare
  v_definition text;
begin
  if to_regprocedure('adaptive.store_online_run_base(jsonb)') is null then
    raise exception 'Migration 012 belum aktif. Jalankan migration 012 lebih dulu.';
  end if;

  select pg_get_functiondef('adaptive.store_online_run_base(jsonb)'::regprocedure)
  into v_definition;

  if position('2026-08-08.1' in v_definition) > 0 then
    -- Publisher migration 011/012 menyebut config version pada guard dan metadata.
    -- Ganti seluruh referensi agar write dengan policy baru tetap fail-closed.
    v_definition := replace(v_definition, '2026-08-08.1', '2026-08-15.1');
    execute v_definition;
  elsif position('2026-08-15.1' in v_definition) > 0 then
    null; -- rerun idempotent
  else
    raise exception 'Config Adaptive V2 migration 012 tidak ditemukan pada publisher.';
  end if;
end;
$$;

-- Pending lama membawa selection weights yang dipelajari dengan Brier atas event
-- berbeda. Mereka tidak boleh disettle memakai action-credit policy baru.
update adaptive.predictions
set status = 'cancelled'
where status = 'pending'
  and engine_version = 'hf-apie-v2-back'
  and config_version = '2026-08-08.1';

update adaptive.engine_configs
set is_active = false
where engine_version = 'hf-apie-v2-back';

insert into adaptive.engine_configs (
  engine_version,
  config_version,
  config,
  is_active
) values (
  'hf-apie-v2-back',
  '2026-08-15.1',
  jsonb_build_object(
    'status', 'adaptive-v2-back-only',
    'target2D', 'belakang',
    'selectionCount', 11,
    'aiDigitCounts', jsonb_build_array(1,2,3,4,5,6),
    'bbfsDigitCounts', jsonb_build_array(5,6,7,8,9),
    'maxHistory', 170,
    'replayWarmup', 28,
    'expertCount', 28,
    'independentSelections', true,
    'historicalSelectionReplay', true,
    'selectionWinPolicy', 'freeze',
    'selectionLossPolicy', 'miss-action-loss',
    'selectionCreditPolicy', 'expert-hit-0-miss-1',
    'confidenceLossPolicy', 'brier-audit-only',
    'globalExpertPolicy', 'learn-every-actual'
  ),
  true
)
on conflict (engine_version, config_version)
do update set
  config = excluded.config,
  is_active = true;

-- Fail closed bila publisher belum sepenuhnya berpindah ke config baru.
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef('adaptive.store_online_run_base(jsonb)'::regprocedure)
  into v_definition;

  if position('2026-08-15.1' in v_definition) = 0
     or position('2026-08-08.1' in v_definition) > 0 then
    raise exception 'Publisher Adaptive belum sepenuhnya memakai config 2026-08-15.1.';
  end if;
end;
$$;

commit;
