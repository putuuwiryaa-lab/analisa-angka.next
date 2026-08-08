begin;

-- Adaptive V2 config 2026-08-08.1
-- Policy:
-- - global expert weights tetap belajar setiap actual result
-- - selection calibration hanya mengubah bobot saat selection MISS
-- - selection yang WIN tetap dicatat/evaluasi tetapi calibration weights dibekukan
--
-- Migration ini memisahkan state/prediction baru dari config 2026-08-07.1 agar
-- audit tidak mencampur dua aturan learning yang berbeda.

do $$
declare
  v_definition text;
begin
  if to_regprocedure('adaptive.store_online_run_base(jsonb)') is null then
    raise exception 'Migration 011 belum aktif. Jalankan migration 011 lebih dulu.';
  end if;

  select pg_get_functiondef('adaptive.store_online_run_base(jsonb)'::regprocedure)
  into v_definition;

  if position('2026-08-07.1' in v_definition) > 0 then
    -- Function migration 011 menyebut config version pada guard dan metadata
    -- engine config. Ganti seluruh referensi agar publisher konsisten.
    v_definition := replace(v_definition, '2026-08-07.1', '2026-08-08.1');
    execute v_definition;
  elsif position('2026-08-08.1' in v_definition) > 0 then
    null; -- rerun idempotent
  else
    raise exception 'Config Adaptive V2 migration 011 tidak ditemukan pada publisher.';
  end if;
end;
$$;

-- Pending dari config lama tidak boleh disettle oleh policy learning baru.
update adaptive.predictions
set status = 'cancelled'
where status = 'pending'
  and engine_version = 'hf-apie-v2-back'
  and config_version = '2026-08-07.1';

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
  '2026-08-08.1',
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
    'selectionLossPolicy', 'recalibrate',
    'globalExpertPolicy', 'learn-every-actual'
  ),
  true
)
on conflict (engine_version, config_version)
do update set
  config = excluded.config,
  is_active = true;

-- Fail closed bila function publisher belum sepenuhnya berpindah ke config baru.
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef('adaptive.store_online_run_base(jsonb)'::regprocedure)
  into v_definition;

  if position('2026-08-08.1' in v_definition) = 0
     or position('2026-08-07.1' in v_definition) > 0 then
    raise exception 'Publisher Adaptive belum sepenuhnya memakai config 2026-08-08.1.';
  end if;
end;
$$;

commit;
