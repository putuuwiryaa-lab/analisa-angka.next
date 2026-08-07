begin;

-- Adaptive V2 contract:
-- - target production hanya 2D belakang
-- - AI 1..6
-- - BBFS 5..9
-- - tepat 11 selection per prediction
--
-- Migration 011 sengaja mempertahankan seluruh row V1 untuk audit. Wrapper V1
-- migration 010 juga dipertahankan agar rollout code/database dapat dilakukan
-- tanpa jendela yang membuat contract lama langsung rusak.

do $$
begin
  if to_regprocedure('adaptive.store_online_run_revision_base(jsonb)') is null then
    raise exception 'Migration 009 belum aktif. Jalankan migration 009 lebih dulu.';
  end if;
  if to_regprocedure('adaptive.store_online_run_calibration_base(jsonb)') is null then
    raise exception 'Migration 010 belum aktif. Jalankan migration 010 lebih dulu.';
  end if;
  if to_regprocedure('adaptive.store_online_run_base(jsonb)') is null then
    raise exception 'Calibration wrapper migration 010 tidak tersedia.';
  end if;
end;
$$;

-- Simpan wrapper 18-selection V1 dengan nama stabil. Pada rerun migration 011,
-- fungsi ini sudah ada sehingga public base V2 tidak di-rename ulang.
do $$
begin
  if to_regprocedure('adaptive.store_online_run_v1_calibration_base(jsonb)') is null then
    alter function adaptive.store_online_run_base(jsonb)
      rename to store_online_run_v1_calibration_base;
  end if;
end;
$$;

create or replace function adaptive.store_online_run_base(
  p_payload jsonb
) returns jsonb
language plpgsql
as $$
declare
  v_prediction jsonb := p_payload->'prediction';
  v_engine_version text := v_prediction->>'engineVersion';
  v_config_version text := v_prediction->>'configVersion';
  v_target_2d text := v_prediction->>'target2D';
  v_selections jsonb := v_prediction->'selections';
  v_settlement jsonb := p_payload->'settlement';
  v_updates jsonb := p_payload->'settlement'->'selectionCalibrationUpdates';
  v_legacy_selections jsonb;
  v_legacy_payload jsonb;
  v_result jsonb;
  v_prediction_id uuid;
  v_settled_prediction_id uuid;
  v_selection_count integer := 0;
  v_selection_key_count integer := 0;
  v_stored_selection_count integer := 0;
  v_settled_selection_count integer := 0;
  v_selection_calibration_published integer := 0;
  v_selection_calibration_updated integer := 0;
  v_update_count integer := 0;
  v_update_key_count integer := 0;
begin
  -- Contract non-V2 tetap memakai wrapper migration 010 secara utuh.
  if v_engine_version is distinct from 'hf-apie-v2-back' then
    return adaptive.store_online_run_v1_calibration_base(p_payload);
  end if;

  if v_config_version is distinct from '2026-08-07.1' then
    raise exception 'Config Adaptive V2 tidak dikenal: %.', coalesce(v_config_version, 'null');
  end if;
  if v_target_2d is distinct from 'belakang' then
    raise exception 'Adaptive V2 hanya boleh menyimpan target 2D belakang.';
  end if;
  if jsonb_typeof(v_selections) <> 'array' then
    raise exception 'Prediction Adaptive V2 harus membawa array selections.';
  end if;

  select
    count(*)::integer,
    count(distinct concat_ws(':', item->>'method', item->>'digitCount'))::integer
  into v_selection_count, v_selection_key_count
  from jsonb_array_elements(v_selections) item;

  if v_selection_count <> 11 or v_selection_key_count <> 11 then
    raise exception 'Adaptive V2 harus menerbitkan tepat 11 selection unik.';
  end if;

  -- Hanya AI1-6 dan BBFS5-9 yang sah; payload digit wajib unik dan sesuai count.
  if exists (
    select 1
    from jsonb_array_elements(v_selections) item
    where not (
      (item->>'method' = 'ai' and (item->>'digitCount')::integer between 1 and 6)
      or
      (item->>'method' = 'bbfs' and (item->>'digitCount')::integer between 5 and 9)
    )
      or coalesce(item->>'digitCount', '') !~ '^[1-9]$'
      or jsonb_typeof(item->'digits') <> 'array'
      or jsonb_array_length(item->'digits') <> (item->>'digitCount')::integer
      or exists (
        select 1
        from jsonb_array_elements_text(item->'digits') digit(value)
        where digit.value !~ '^[0-9]$'
      )
      or (
        select count(distinct digit.value)
        from jsonb_array_elements_text(item->'digits') digit(value)
      ) <> (item->>'digitCount')::integer
  ) then
    raise exception 'Payload selection Adaptive V2 tidak valid.';
  end if;

  if exists (
    select 1
    from (
      values
        ('ai', 1), ('ai', 2), ('ai', 3), ('ai', 4), ('ai', 5), ('ai', 6),
        ('bbfs', 5), ('bbfs', 6), ('bbfs', 7), ('bbfs', 8), ('bbfs', 9)
    ) expected(method, digit_count)
    where not exists (
      select 1
      from jsonb_array_elements(v_selections) item
      where item->>'method' = expected.method
        and (item->>'digitCount')::integer = expected.digit_count
    )
  ) then
    raise exception 'Kombinasi AI1-6 dan BBFS5-9 Adaptive V2 belum lengkap.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_selections) item
    where jsonb_typeof(item->'calibrationWeights') <> 'object'
      or coalesce(item->>'calibrationStateRevision', '') !~ '^[0-9]+$'
      or exists (
        select 1
        from jsonb_each_text(item->'calibrationWeights') weight
        where weight.value !~ '^[0-9]+([.][0-9]+)?([eE][+-]?[0-9]+)?$'
          or weight.value::double precision < 0
      )
      or abs(coalesce((
        select sum(weight.value::double precision)
        from jsonb_each_text(item->'calibrationWeights') weight
      ), 0) - 1) > 0.000001
  ) then
    raise exception 'Metadata calibration selection Adaptive V2 tidak valid.';
  end if;

  -- Publisher migration 005 masih memiliki kontrak 18 selection. Tambahkan tujuh
  -- selection legacy hanya ke payload internal transaksi. Mereka tidak bertahan
  -- setelah fungsi selesai dan tidak menjadi bagian snapshot V2.
  v_legacy_selections := v_selections || jsonb_build_array(
    jsonb_build_object(
      'method', 'ai', 'digitCount', 7,
      'digits', jsonb_build_array(0,1,2,3,4,5,6),
      'estimatedSuccess', 0.91, 'baselineSuccess', 0.91, 'lift', 0, 'selectionMargin', 0
    ),
    jsonb_build_object(
      'method', 'ai', 'digitCount', 8,
      'digits', jsonb_build_array(0,1,2,3,4,5,6,7),
      'estimatedSuccess', 0.96, 'baselineSuccess', 0.96, 'lift', 0, 'selectionMargin', 0
    ),
    jsonb_build_object(
      'method', 'ai', 'digitCount', 9,
      'digits', jsonb_build_array(0,1,2,3,4,5,6,7,8),
      'estimatedSuccess', 0.99, 'baselineSuccess', 0.99, 'lift', 0, 'selectionMargin', 0
    ),
    jsonb_build_object(
      'method', 'bbfs', 'digitCount', 1,
      'digits', jsonb_build_array(0),
      'estimatedSuccess', 0.01, 'baselineSuccess', 0.01, 'lift', 0, 'selectionMargin', 0
    ),
    jsonb_build_object(
      'method', 'bbfs', 'digitCount', 2,
      'digits', jsonb_build_array(0,1),
      'estimatedSuccess', 0.04, 'baselineSuccess', 0.04, 'lift', 0, 'selectionMargin', 0
    ),
    jsonb_build_object(
      'method', 'bbfs', 'digitCount', 3,
      'digits', jsonb_build_array(0,1,2),
      'estimatedSuccess', 0.09, 'baselineSuccess', 0.09, 'lift', 0, 'selectionMargin', 0
    ),
    jsonb_build_object(
      'method', 'bbfs', 'digitCount', 4,
      'digits', jsonb_build_array(0,1,2,3),
      'estimatedSuccess', 0.16, 'baselineSuccess', 0.16, 'lift', 0, 'selectionMargin', 0
    )
  );
  v_legacy_payload := jsonb_set(
    p_payload,
    '{prediction,selections}',
    v_legacy_selections,
    true
  );

  -- Agar publisher V1 dapat melakukan settlement tepat 18 row, tujuh row legacy
  -- dibuat sementara pada prediction V2 sebelumnya. ON DELETE CASCADE menghapus
  -- evaluation dummy sebelum transaksi commit.
  if v_settlement is not null and jsonb_typeof(v_settlement) = 'object' then
    v_settled_prediction_id := (v_settlement->>'predictionId')::uuid;

    insert into adaptive.published_selections (
      prediction_id,
      method,
      digit_count,
      digits,
      estimated_success,
      baseline_success,
      lift,
      selection_margin
    ) values
      (v_settled_prediction_id, 'ai', 7, array[0,1,2,3,4,5,6]::smallint[], 0.91, 0.91, 0, 0),
      (v_settled_prediction_id, 'ai', 8, array[0,1,2,3,4,5,6,7]::smallint[], 0.96, 0.96, 0, 0),
      (v_settled_prediction_id, 'ai', 9, array[0,1,2,3,4,5,6,7,8]::smallint[], 0.99, 0.99, 0, 0),
      (v_settled_prediction_id, 'bbfs', 1, array[0]::smallint[], 0.01, 0.01, 0, 0),
      (v_settled_prediction_id, 'bbfs', 2, array[0,1]::smallint[], 0.04, 0.04, 0, 0),
      (v_settled_prediction_id, 'bbfs', 3, array[0,1,2]::smallint[], 0.09, 0.09, 0, 0),
      (v_settled_prediction_id, 'bbfs', 4, array[0,1,2,3]::smallint[], 0.16, 0.16, 0, 0)
    on conflict (prediction_id, method, digit_count) do nothing;
  end if;

  -- Panggil publisher full migration 005 secara langsung; wrapper migration 010
  -- tidak dipakai karena contract calibration-nya masih 18.
  v_result := adaptive.store_online_run_calibration_base(v_legacy_payload);
  v_prediction_id := (v_result->>'predictionId')::uuid;

  -- Hapus selection dummy dari prediction baru dan prediction yang di-settle.
  delete from adaptive.published_selections
  where prediction_id = v_prediction_id
    and not (
      (method = 'ai' and digit_count between 1 and 6)
      or
      (method = 'bbfs' and digit_count between 5 and 9)
    );

  if v_settled_prediction_id is not null then
    delete from adaptive.published_selections
    where prediction_id = v_settled_prediction_id
      and not (
        (method = 'ai' and digit_count between 1 and 6)
        or
        (method = 'bbfs' and digit_count between 5 and 9)
      );
  end if;

  select count(*)::integer
  into v_stored_selection_count
  from adaptive.published_selections
  where prediction_id = v_prediction_id;

  if v_stored_selection_count <> 11 then
    raise exception 'Snapshot Adaptive V2 gagal menyimpan tepat 11 selection.';
  end if;

  update adaptive.predictions
  set
    selection_count = 11,
    snapshot_complete = true
  where id = v_prediction_id;

  update adaptive.published_selections selection
  set
    calibration_weights = item->'calibrationWeights',
    calibration_state_revision = (item->>'calibrationStateRevision')::bigint
  from jsonb_array_elements(v_selections) item
  where selection.prediction_id = v_prediction_id
    and selection.method = item->>'method'
    and selection.digit_count = (item->>'digitCount')::smallint;

  get diagnostics v_selection_calibration_published = row_count;
  if v_selection_calibration_published <> 11 then
    raise exception 'Gagal menyimpan 11 calibration state Adaptive V2.';
  end if;

  if v_settlement is not null and jsonb_typeof(v_settlement) = 'object' then
    if jsonb_typeof(v_updates) <> 'array' then
      raise exception 'Settlement Adaptive V2 harus membawa selectionCalibrationUpdates.';
    end if;

    select
      count(*)::integer,
      count(distinct concat_ws(':', item->>'method', item->>'digitCount'))::integer
    into v_update_count, v_update_key_count
    from jsonb_array_elements(v_updates) item;

    if v_update_count <> 11 or v_update_key_count <> 11 then
      raise exception 'Settlement Adaptive V2 harus membawa 11 update calibration unik.';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(v_updates) item
      where not (
        (item->>'method' = 'ai' and (item->>'digitCount')::integer between 1 and 6)
        or
        (item->>'method' = 'bbfs' and (item->>'digitCount')::integer between 5 and 9)
      )
        or jsonb_typeof(item->'weightsBefore') <> 'object'
        or jsonb_typeof(item->'weightsAfter') <> 'object'
        or jsonb_typeof(item->'expertLosses') <> 'object'
        or jsonb_typeof(item->'hit') <> 'boolean'
        or coalesce(item->>'stateRevisionBefore', '') !~ '^[0-9]+$'
        or coalesce(item->>'stateRevisionAfter', '') !~ '^[0-9]+$'
        or (item->>'stateRevisionAfter')::bigint <>
          (item->>'stateRevisionBefore')::bigint + 1
        or coalesce(item->>'calibrationLoss', '') !~
          '^[0-9]+([.][0-9]+)?([eE][+-]?[0-9]+)?$'
        or (item->>'calibrationLoss')::real < 0
        or (item->>'calibrationLoss')::real > 1
        or abs(coalesce((
          select sum(weight.value::double precision)
          from jsonb_each_text(item->'weightsBefore') weight
        ), 0) - 1) > 0.000001
        or abs(coalesce((
          select sum(weight.value::double precision)
          from jsonb_each_text(item->'weightsAfter') weight
        ), 0) - 1) > 0.000001
    ) then
      raise exception 'Payload update calibration Adaptive V2 tidak valid.';
    end if;

    if (
      select count(*)
      from jsonb_array_elements(v_updates) item
      join adaptive.published_selections previous
        on previous.prediction_id = v_settled_prediction_id
        and previous.method = item->>'method'
        and previous.digit_count = (item->>'digitCount')::smallint
        and previous.calibration_state_revision =
          (item->>'stateRevisionBefore')::bigint
    ) <> 11 then
      raise exception using
        errcode = '40001',
        message = 'Selection calibration state Adaptive V2 berubah sebelum settlement disimpan.';
    end if;

    update adaptive.selection_evaluations evaluation
    set
      calibration_loss = (item->>'calibrationLoss')::real,
      calibration_expert_losses = item->'expertLosses',
      calibration_weights_before = item->'weightsBefore',
      calibration_weights_after = item->'weightsAfter',
      calibration_state_revision_before = (item->>'stateRevisionBefore')::bigint,
      calibration_state_revision_after = (item->>'stateRevisionAfter')::bigint
    from jsonb_array_elements(v_updates) item
    where evaluation.prediction_id = v_settled_prediction_id
      and evaluation.method = item->>'method'
      and evaluation.digit_count = (item->>'digitCount')::smallint
      and evaluation.hit = (item->>'hit')::boolean;

    get diagnostics v_selection_calibration_updated = row_count;
    if v_selection_calibration_updated <> 11 then
      raise exception 'Gagal mengaudit 11 update calibration Adaptive V2.';
    end if;

    select count(*)::integer
    into v_settled_selection_count
    from adaptive.selection_evaluations
    where prediction_id = v_settled_prediction_id;

    if v_settled_selection_count <> 11 then
      raise exception 'Settlement final Adaptive V2 harus menyisakan tepat 11 evaluation.';
    end if;

    if (
      select count(*)
      from jsonb_array_elements(v_updates) item
      join adaptive.published_selections current_selection
        on current_selection.prediction_id = v_prediction_id
        and current_selection.method = item->>'method'
        and current_selection.digit_count = (item->>'digitCount')::smallint
        and current_selection.calibration_state_revision =
          (item->>'stateRevisionAfter')::bigint
    ) <> 11 then
      raise exception 'Prediction baru tidak membawa revision calibration Adaptive V2 hasil settlement.';
    end if;
  end if;

  insert into adaptive.engine_configs (
    engine_version,
    config_version,
    config,
    is_active
  ) values (
    'hf-apie-v2-back',
    '2026-08-07.1',
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
      'historicalSelectionReplay', true
    ),
    true
  )
  on conflict (engine_version, config_version)
  do update set config = excluded.config, is_active = true;

  return v_result || jsonb_build_object(
    'selectionsPublished', 11,
    'selectionsSettled', case when v_settlement is null then 0 else 11 end,
    'snapshotComplete', true,
    'selectionCalibrationPublished', v_selection_calibration_published,
    'selectionCalibrationUpdated', v_selection_calibration_updated,
    'independentSelectionCalibration', true,
    'adaptiveV2BackOnly', true
  );
end;
$$;

-- V1 settled history tetap utuh. Pending V1 tidak boleh lagi menjadi kandidat
-- settlement setelah V2 mengambil alih publication.
update adaptive.predictions
set status = 'cancelled'
where status = 'pending'
  and engine_version = 'hf-apie-v1-online';

update adaptive.engine_configs
set is_active = false
where engine_version = 'hf-apie-v1-online';

insert into adaptive.engine_configs (
  engine_version,
  config_version,
  config,
  is_active
) values (
  'hf-apie-v2-back',
  '2026-08-07.1',
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
    'historicalSelectionReplay', true
  ),
  true
)
on conflict (engine_version, config_version)
do update set config = excluded.config, is_active = true;

commit;
