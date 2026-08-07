begin;

-- Migration 010 dipasang setelah migration 009. Public wrapper dan rolling
-- lineage guard tetap berada di atas fungsi store_online_run_base ini.
do $$
begin
  if to_regprocedure('adaptive.store_online_run_revision_base(jsonb)') is null then
    raise exception 'Migration 009 belum aktif. Jalankan migration 009 lebih dulu.';
  end if;
  if to_regprocedure('adaptive.store_online_run_base(jsonb)') is null then
    raise exception 'Full publication base function tidak tersedia.';
  end if;
end;
$$;

alter table adaptive.published_selections
  add column if not exists calibration_weights jsonb not null default '{}'::jsonb,
  add column if not exists calibration_state_revision bigint not null default 0
    check (calibration_state_revision >= 0);

alter table adaptive.selection_evaluations
  add column if not exists calibration_loss real,
  add column if not exists calibration_expert_losses jsonb not null default '{}'::jsonb,
  add column if not exists calibration_weights_before jsonb not null default '{}'::jsonb,
  add column if not exists calibration_weights_after jsonb not null default '{}'::jsonb,
  add column if not exists calibration_state_revision_before bigint,
  add column if not exists calibration_state_revision_after bigint,
  add constraint selection_evaluations_calibration_loss_check
    check (calibration_loss is null or calibration_loss between 0 and 1),
  add constraint selection_evaluations_calibration_revision_check
    check (
      calibration_state_revision_before is null
      or calibration_state_revision_after = calibration_state_revision_before + 1
    );

-- Preserve the migration-005 publisher under a stable internal name, then put
-- this calibration wrapper back at the name expected by migration 009.
do $$
begin
  if to_regprocedure('adaptive.store_online_run_calibration_base(jsonb)') is null then
    alter function adaptive.store_online_run_base(jsonb)
      rename to store_online_run_calibration_base;
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
  v_selections jsonb := p_payload->'prediction'->'selections';
  v_settlement jsonb := p_payload->'settlement';
  v_updates jsonb := p_payload->'settlement'->'selectionCalibrationUpdates';
  v_result jsonb;
  v_prediction_id uuid;
  v_settled_prediction_id uuid;
  v_selection_calibration_published integer := 0;
  v_selection_calibration_updated integer := 0;
  v_update_count integer := 0;
  v_update_key_count integer := 0;
begin
  if jsonb_typeof(v_selections) <> 'array'
    or jsonb_array_length(v_selections) <> 18
  then
    raise exception 'Prediction harus membawa tepat 18 selection untuk calibration.';
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
          or not isfinite(weight.value::double precision)
      )
  ) then
    raise exception 'Metadata calibration pada prediction selection tidak valid.';
  end if;

  v_result := adaptive.store_online_run_calibration_base(p_payload);
  v_prediction_id := (v_result->>'predictionId')::uuid;

  update adaptive.published_selections selection
  set
    calibration_weights = item->'calibrationWeights',
    calibration_state_revision = (item->>'calibrationStateRevision')::bigint
  from jsonb_array_elements(v_selections) item
  where selection.prediction_id = v_prediction_id
    and selection.method = item->>'method'
    and selection.digit_count = (item->>'digitCount')::smallint;

  get diagnostics v_selection_calibration_published = row_count;

  if v_selection_calibration_published <> 18 then
    raise exception 'Gagal menyimpan 18 calibration state pada prediction baru.';
  end if;

  if v_settlement is not null and jsonb_typeof(v_settlement) = 'object' then
    if jsonb_typeof(v_updates) <> 'array' then
      raise exception 'Settlement harus membawa selectionCalibrationUpdates.';
    end if;

    select
      count(*)::integer,
      count(distinct concat_ws(':', item->>'method', item->>'digitCount'))::integer
    into v_update_count, v_update_key_count
    from jsonb_array_elements(v_updates) item;

    if v_update_count <> 18 or v_update_key_count <> 18 then
      raise exception 'Settlement harus membawa 18 update calibration unik.';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(v_updates) item
      where item->>'method' not in ('ai', 'bbfs')
        or coalesce(item->>'digitCount', '') !~ '^[1-9]$'
        or jsonb_typeof(item->'weightsBefore') <> 'object'
        or jsonb_typeof(item->'weightsAfter') <> 'object'
        or jsonb_typeof(item->'expertLosses') <> 'object'
        or jsonb_typeof(item->'hit') <> 'boolean'
        or coalesce(item->>'stateRevisionBefore', '') !~ '^[0-9]+$'
        or coalesce(item->>'stateRevisionAfter', '') !~ '^[0-9]+$'
        or (item->>'stateRevisionAfter')::bigint <>
          (item->>'stateRevisionBefore')::bigint + 1
        or (item->>'calibrationLoss')::real < 0
        or (item->>'calibrationLoss')::real > 1
    ) then
      raise exception 'Payload update calibration independen tidak valid.';
    end if;

    v_settled_prediction_id := (v_settlement->>'predictionId')::uuid;

    -- Optimistic revision is checked independently per method + digit count.
    if (
      select count(*)
      from jsonb_array_elements(v_updates) item
      join adaptive.published_selections previous
        on previous.prediction_id = v_settled_prediction_id
        and previous.method = item->>'method'
        and previous.digit_count = (item->>'digitCount')::smallint
        and previous.calibration_state_revision =
          (item->>'stateRevisionBefore')::bigint
    ) <> 18 then
      raise exception using
        errcode = '40001',
        message = 'Selection calibration state berubah sebelum settlement disimpan.';
    end if;

    update adaptive.selection_evaluations evaluation
    set
      calibration_loss = (item->>'calibrationLoss')::real,
      calibration_expert_losses = item->'expertLosses',
      calibration_weights_before = item->'weightsBefore',
      calibration_weights_after = item->'weightsAfter',
      calibration_state_revision_before =
        (item->>'stateRevisionBefore')::bigint,
      calibration_state_revision_after =
        (item->>'stateRevisionAfter')::bigint
    from jsonb_array_elements(v_updates) item
    where evaluation.prediction_id = v_settled_prediction_id
      and evaluation.method = item->>'method'
      and evaluation.digit_count = (item->>'digitCount')::smallint
      and evaluation.hit = (item->>'hit')::boolean;

    get diagnostics v_selection_calibration_updated = row_count;

    if v_selection_calibration_updated <> 18 then
      raise exception 'Gagal mengaudit 18 update calibration independen.';
    end if;

    -- Prediction baru must carry exactly the resulting revision for every
    -- independent selection state.
    if (
      select count(*)
      from jsonb_array_elements(v_updates) item
      join adaptive.published_selections current_selection
        on current_selection.prediction_id = v_prediction_id
        and current_selection.method = item->>'method'
        and current_selection.digit_count = (item->>'digitCount')::smallint
        and current_selection.calibration_state_revision =
          (item->>'stateRevisionAfter')::bigint
    ) <> 18 then
      raise exception 'Prediction baru tidak membawa revision calibration hasil settlement.';
    end if;
  end if;

  insert into adaptive.engine_configs (
    engine_version,
    config_version,
    config,
    is_active
  ) values (
    v_prediction->>'engineVersion',
    v_prediction->>'configVersion',
    jsonb_build_object(
      'status', 'online-learning-independent-selection-calibration',
      'selectionCount', 18,
      'calibrationScope', 'method-digit-count',
      'independentSelections', true,
      'methods', jsonb_build_array('ai', 'bbfs'),
      'digitCounts', jsonb_build_array(1, 2, 3, 4, 5, 6, 7, 8, 9)
    ),
    true
  )
  on conflict (engine_version, config_version)
  do update set config = excluded.config, is_active = true;

  return v_result || jsonb_build_object(
    'selectionCalibrationPublished', v_selection_calibration_published,
    'selectionCalibrationUpdated', v_selection_calibration_updated,
    'independentSelectionCalibration', true
  );
end;
$$;

commit;
