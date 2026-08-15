begin;

-- Adaptive V2 config 2026-08-15.2
-- Policy:
-- - selection credit assignment 2026-08-15.1 tetap dipertahankan
-- - adaptive-window memakai evidence gate multiscale pada horizon 21/42/85
-- - horizon 170 menjadi fallback saat perubahan hanya berupa sampling noise
-- - adaptive-decay memakai regime scale yang sama dan tidak lagi memakai raw
--   total variation 21-vs-170 pada 100 bucket yang sparse

do $$
declare
  v_definition text;
begin
  if to_regprocedure('adaptive.store_online_run_base(jsonb)') is null then
    raise exception 'Migration 013 belum aktif. Jalankan migration 013 lebih dulu.';
  end if;

  select pg_get_functiondef('adaptive.store_online_run_base(jsonb)'::regprocedure)
  into v_definition;

  if position('2026-08-15.1' in v_definition) > 0 then
    v_definition := replace(v_definition, '2026-08-15.1', '2026-08-15.2');
    execute v_definition;
  elsif position('2026-08-15.2' in v_definition) > 0 then
    null; -- rerun idempotent
  else
    raise exception 'Config Adaptive migration 013 tidak ditemukan pada publisher.';
  end if;
end;
$$;

-- Prediction config lama dibentuk oleh expert horizon/decay dengan detector lama.
-- Jangan settlement prediction tersebut memakai model regime baru.
update adaptive.predictions
set status = 'cancelled'
where status = 'pending'
  and engine_version = 'hf-apie-v2-back'
  and config_version = '2026-08-15.1';

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
  '2026-08-15.2',
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
    'globalExpertPolicy', 'learn-every-actual',
    'regimeDetectionPolicy', 'pearson-multiscale-evidence-v1',
    'regimeCandidateHorizons', jsonb_build_array(21,42,85),
    'regimeFallbackHorizon', 170,
    'regimeMinimumSegment', 21,
    'regimeEvidenceThreshold', 30,
    'regimeFeatures', jsonb_build_array('left','right','sum-mod-10','difference-mod-10'),
    'adaptiveDecayPolicy', 'shared-regime-scale'
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

  if position('2026-08-15.2' in v_definition) = 0
     or position('2026-08-15.1' in v_definition) > 0 then
    raise exception 'Publisher Adaptive belum sepenuhnya memakai config 2026-08-15.2.';
  end if;
end;
$$;

commit;
