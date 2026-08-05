begin;

alter table adaptive.predictions
  add column if not exists selection_count smallint not null default 0
    check (selection_count between 0 and 18),
  add column if not exists snapshot_complete boolean not null default false;

alter table adaptive.reconciliation_runs
  add column if not exists selections_published bigint not null default 0
    check (selections_published >= 0),
  add column if not exists selections_settled bigint not null default 0
    check (selections_settled >= 0);

create table if not exists adaptive.selection_evaluations (
  id uuid primary key default gen_random_uuid(),
  published_selection_id uuid not null unique
    references adaptive.published_selections(id) on delete cascade,
  prediction_id uuid not null
    references adaptive.predictions(id) on delete cascade,
  method text not null check (method in ('ai', 'bbfs')),
  digit_count smallint not null check (digit_count between 1 and 9),
  digits smallint[] not null,
  actual_left smallint not null check (actual_left between 0 and 9),
  actual_right smallint not null check (actual_right between 0 and 9),
  actual_pair smallint not null check (actual_pair between 0 and 99),
  hit boolean not null,
  estimated_success real not null check (estimated_success between 0 and 1),
  baseline_success real not null check (baseline_success between 0 and 1),
  lift real not null,
  created_at timestamptz not null default now(),
  check (cardinality(digits) = digit_count),
  unique (prediction_id, method, digit_count)
);

create index if not exists selection_evaluations_prediction_idx
  on adaptive.selection_evaluations (prediction_id, method, digit_count);

create index if not exists selection_evaluations_method_idx
  on adaptive.selection_evaluations (method, digit_count, created_at desc);

update adaptive.predictions p
set
  selection_count = counts.selection_count,
  snapshot_complete = counts.selection_count = 18
from (
  select
    prediction.id,
    count(selection.id)::smallint as selection_count
  from adaptive.predictions prediction
  left join adaptive.published_selections selection
    on selection.prediction_id = prediction.id
  group by prediction.id
) counts
where counts.id = p.id;

-- Snapshot V1 lama hanya mempunyai satu selection. Batalkan pending yang belum
-- lengkap agar reconciliation otomatis menerbitkan ulang 18 selection dari matrix baru.
update adaptive.predictions
set status = 'cancelled'
where status = 'pending'
  and snapshot_complete = false;

create or replace function adaptive.store_online_run(
  p_payload jsonb
) returns jsonb
language plpgsql
as $$
declare
  v_market_id text := p_payload->>'marketId';
  v_market_name text := p_payload->>'marketName';
  v_target_draw_key text := p_payload->>'targetDrawKey';
  v_prediction jsonb := p_payload->'prediction';
  v_state jsonb := p_payload->'state';
  v_replay jsonb := p_payload->'prediction'->'replay';
  v_selections jsonb := p_payload->'prediction'->'selections';
  v_settlement jsonb := p_payload->'settlement';
  v_prediction_id uuid;
  v_state_revision bigint;
  v_settled_prediction_id uuid;
  v_draw text;
  v_ordinal bigint;
  v_selection_count integer := 0;
  v_selection_key_count integer := 0;
  v_stored_selection_count integer := 0;
  v_settled_selection_count integer := 0;
begin
  if v_market_id is null or v_market_name is null or v_target_draw_key is null then
    raise exception 'Identitas online run tidak lengkap.';
  end if;

  if jsonb_typeof(v_selections) <> 'array' then
    raise exception 'Prediction harus membawa array selections.';
  end if;

  select
    count(*)::integer,
    count(distinct concat_ws(':', item->>'method', item->>'digitCount'))::integer
  into v_selection_count, v_selection_key_count
  from jsonb_array_elements(v_selections) item;

  if v_selection_count <> 18 or v_selection_key_count <> 18 then
    raise exception 'Adaptive harus menerbitkan tepat 18 selection unik.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_selections) item
    where item->>'method' not in ('ai', 'bbfs')
      or coalesce(item->>'digitCount', '') !~ '^[1-9]$'
      or jsonb_typeof(item->'digits') <> 'array'
      or jsonb_array_length(item->'digits') <> (item->>'digitCount')::integer
      or exists (
        select 1
        from jsonb_array_elements_text(item->'digits') digit
        where digit !~ '^[0-9]$'
      )
      or (
        select count(distinct digit)
        from jsonb_array_elements_text(item->'digits') digit
      ) <> (item->>'digitCount')::integer
  ) then
    raise exception 'Payload selection Adaptive tidak valid.';
  end if;

  if exists (
    select 1
    from (values ('ai'), ('bbfs')) method(value)
    cross join generate_series(1, 9) digit_count
    where not exists (
      select 1
      from jsonb_array_elements(v_selections) item
      where item->>'method' = method.value
        and (item->>'digitCount')::integer = digit_count
    )
  ) then
    raise exception 'Kombinasi AI/BBFS 1-9 belum lengkap.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      concat_ws(
        '|',
        v_market_id,
        v_prediction->>'target2D',
        v_prediction->>'engineVersion',
        v_prediction->>'configVersion'
      ),
      0
    )
  );

  for v_draw, v_ordinal in
    select value, ordinality
    from jsonb_array_elements_text(p_payload->'historyDraws') with ordinality
  loop
    insert into adaptive.result_snapshots (
      market_id,
      market_name,
      draw_key,
      result_4d,
      source_sequence
    ) values (
      v_market_id,
      v_market_name,
      'seq:' || v_ordinal::text,
      v_draw,
      v_ordinal::integer
    )
    on conflict (market_id, draw_key)
    do update set
      market_name = excluded.market_name,
      result_4d = excluded.result_4d,
      source_sequence = excluded.source_sequence,
      synced_at = now();
  end loop;

  insert into adaptive.engine_states as existing (
    market_id,
    target_2d,
    engine_version,
    config_version,
    family_weights,
    horizon_weights,
    expert_weights,
    drift_state,
    detector_state,
    last_processed_draw_key,
    state_revision,
    processed_history_length,
    last_processed_draw,
    replay_count,
    learning_metrics,
    updated_at
  ) values (
    v_market_id,
    v_state->>'target2D',
    v_state->>'engineVersion',
    v_state->>'configVersion',
    coalesce(v_state->'familyWeights', '{}'::jsonb),
    coalesce(v_state->'horizonWeights', '{}'::jsonb),
    coalesce(v_state->'expertWeights', '{}'::jsonb),
    'stable',
    '{}'::jsonb,
    v_state->>'lastProcessedDraw',
    1,
    (v_state->>'processedHistoryLength')::integer,
    v_state->>'lastProcessedDraw',
    case when (v_replay->>'processedSteps')::integer > 0 then 1 else 0 end,
    jsonb_build_object(
      'lastReplayMode', v_replay->>'mode',
      'lastProcessedSteps', (v_replay->>'processedSteps')::integer,
      'meanEnsembleLoss', (v_replay->>'meanEnsembleLoss')::real,
      'updatedAt', now()
    ),
    now()
  )
  on conflict (market_id, target_2d, engine_version, config_version)
  do update set
    family_weights = excluded.family_weights,
    horizon_weights = excluded.horizon_weights,
    expert_weights = excluded.expert_weights,
    last_processed_draw_key = excluded.last_processed_draw_key,
    processed_history_length = excluded.processed_history_length,
    last_processed_draw = excluded.last_processed_draw,
    replay_count = existing.replay_count +
      case when (v_replay->>'processedSteps')::integer > 0 then 1 else 0 end,
    learning_metrics = excluded.learning_metrics,
    state_revision = existing.state_revision + case
      when existing.processed_history_length is distinct from excluded.processed_history_length
        or existing.last_processed_draw is distinct from excluded.last_processed_draw
        or existing.expert_weights is distinct from excluded.expert_weights
      then 1 else 0 end,
    updated_at = now()
  returning state_revision into v_state_revision;

  insert into adaptive.predictions (
    market_id,
    market_name,
    target_draw_key,
    target_2d,
    engine_version,
    config_version,
    history_cutoff_key,
    history_length,
    latest_draw,
    pair_probabilities,
    left_probabilities,
    right_probabilities,
    expert_weights,
    signal_strength,
    drift_state,
    status,
    state_revision,
    weighting_mode,
    selection_count,
    snapshot_complete
  ) values (
    v_market_id,
    v_market_name,
    v_target_draw_key,
    v_prediction->>'target2D',
    v_prediction->>'engineVersion',
    v_prediction->>'configVersion',
    v_prediction->>'historyCutoffKey',
    (v_prediction->>'historyLength')::integer,
    v_prediction->>'latestDraw',
    array(select value::real from jsonb_array_elements_text(v_prediction->'pairProbabilities')),
    array(select value::real from jsonb_array_elements_text(v_prediction->'leftProbabilities')),
    array(select value::real from jsonb_array_elements_text(v_prediction->'rightProbabilities')),
    coalesce(v_prediction->'expertWeights', '{}'::jsonb),
    v_prediction->>'signalStrength',
    'stable',
    'pending',
    v_state_revision,
    'online',
    0,
    false
  )
  on conflict (market_id, target_draw_key, target_2d, engine_version, config_version)
  do update set
    market_name = excluded.market_name,
    history_cutoff_key = excluded.history_cutoff_key,
    history_length = excluded.history_length,
    latest_draw = excluded.latest_draw,
    pair_probabilities = excluded.pair_probabilities,
    left_probabilities = excluded.left_probabilities,
    right_probabilities = excluded.right_probabilities,
    expert_weights = excluded.expert_weights,
    signal_strength = excluded.signal_strength,
    state_revision = excluded.state_revision,
    weighting_mode = excluded.weighting_mode,
    status = 'pending',
    settled_at = null,
    selection_count = 0,
    snapshot_complete = false
  returning id into v_prediction_id;

  delete from adaptive.published_selections
  where prediction_id = v_prediction_id;

  insert into adaptive.published_selections (
    prediction_id,
    method,
    digit_count,
    digits,
    estimated_success,
    baseline_success,
    lift,
    selection_margin
  )
  select
    v_prediction_id,
    item->>'method',
    (item->>'digitCount')::smallint,
    array(select value::smallint from jsonb_array_elements_text(item->'digits')),
    (item->>'estimatedSuccess')::real,
    (item->>'baselineSuccess')::real,
    (item->>'lift')::real,
    (item->>'selectionMargin')::real
  from jsonb_array_elements(v_selections) item
  order by item->>'method', (item->>'digitCount')::integer;

  select count(*)::integer
  into v_stored_selection_count
  from adaptive.published_selections
  where prediction_id = v_prediction_id;

  if v_stored_selection_count <> 18 then
    raise exception 'Snapshot Adaptive gagal menyimpan 18 selection.';
  end if;

  update adaptive.predictions
  set
    selection_count = v_stored_selection_count,
    snapshot_complete = true
  where id = v_prediction_id;

  if v_settlement is not null and jsonb_typeof(v_settlement) = 'object' then
    v_settled_prediction_id := (v_settlement->>'predictionId')::uuid;

    insert into adaptive.evaluations (
      prediction_id,
      actual_pair,
      pair_brier,
      left_brier,
      right_brier,
      combined_loss,
      ai_results,
      bbfs_results,
      expert_losses,
      weights_before,
      weights_after,
      drift_before,
      drift_after
    ) values (
      v_settled_prediction_id,
      (v_settlement->>'actualPair')::smallint,
      (v_settlement->>'pairBrier')::real,
      (v_settlement->>'leftBrier')::real,
      (v_settlement->>'rightBrier')::real,
      (v_settlement->>'combinedLoss')::real,
      coalesce(v_settlement->'aiResults', '{}'::jsonb),
      coalesce(v_settlement->'bbfsResults', '{}'::jsonb),
      coalesce(v_settlement->'expertLosses', '{}'::jsonb),
      coalesce(v_settlement->'weightsBefore', '{}'::jsonb),
      coalesce(v_settlement->'weightsAfter', '{}'::jsonb),
      'stable',
      'stable'
    )
    on conflict (prediction_id)
    do update set
      actual_pair = excluded.actual_pair,
      pair_brier = excluded.pair_brier,
      left_brier = excluded.left_brier,
      right_brier = excluded.right_brier,
      combined_loss = excluded.combined_loss,
      ai_results = excluded.ai_results,
      bbfs_results = excluded.bbfs_results,
      expert_losses = excluded.expert_losses,
      weights_before = excluded.weights_before,
      weights_after = excluded.weights_after;

    insert into adaptive.selection_evaluations (
      published_selection_id,
      prediction_id,
      method,
      digit_count,
      digits,
      actual_left,
      actual_right,
      actual_pair,
      hit,
      estimated_success,
      baseline_success,
      lift
    )
    select
      selection.id,
      selection.prediction_id,
      selection.method,
      selection.digit_count,
      selection.digits,
      (v_settlement->>'actualLeft')::smallint,
      (v_settlement->>'actualRight')::smallint,
      (v_settlement->>'actualPair')::smallint,
      case
        when selection.method = 'ai' then
          (v_settlement->>'actualLeft')::smallint = any(selection.digits)
          or (v_settlement->>'actualRight')::smallint = any(selection.digits)
        else
          (v_settlement->>'actualLeft')::smallint = any(selection.digits)
          and (v_settlement->>'actualRight')::smallint = any(selection.digits)
      end,
      selection.estimated_success,
      selection.baseline_success,
      selection.lift
    from adaptive.published_selections selection
    where selection.prediction_id = v_settled_prediction_id
    on conflict (published_selection_id)
    do update set
      actual_left = excluded.actual_left,
      actual_right = excluded.actual_right,
      actual_pair = excluded.actual_pair,
      hit = excluded.hit,
      estimated_success = excluded.estimated_success,
      baseline_success = excluded.baseline_success,
      lift = excluded.lift;

    get diagnostics v_settled_selection_count = row_count;

    if v_settled_selection_count <> 18 then
      raise exception 'Settlement Adaptive harus mengevaluasi tepat 18 selection.';
    end if;

    update adaptive.predictions
    set status = 'settled',
        settled_at = coalesce(settled_at, now())
    where id = v_settled_prediction_id
      and status <> 'cancelled';
  end if;

  if (v_replay->>'processedSteps')::integer > 0 then
    insert into adaptive.replay_runs (
      market_id,
      target_2d,
      engine_version,
      config_version,
      replay_mode,
      start_history_length,
      end_history_length,
      processed_steps,
      mean_ensemble_loss,
      expert_mean_losses,
      state_revision
    ) values (
      v_market_id,
      v_prediction->>'target2D',
      v_prediction->>'engineVersion',
      v_prediction->>'configVersion',
      v_replay->>'mode',
      (v_replay->>'startHistoryLength')::integer,
      (v_replay->>'endHistoryLength')::integer,
      (v_replay->>'processedSteps')::integer,
      (v_replay->>'meanEnsembleLoss')::real,
      coalesce(v_replay->'expertMeanLosses', '{}'::jsonb),
      v_state_revision
    )
    on conflict (
      market_id,
      target_2d,
      engine_version,
      config_version,
      end_history_length,
      replay_mode
    )
    do update set
      processed_steps = excluded.processed_steps,
      mean_ensemble_loss = excluded.mean_ensemble_loss,
      expert_mean_losses = excluded.expert_mean_losses,
      state_revision = excluded.state_revision;
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
      'status', 'online-learning-full-publication',
      'selectionCount', 18,
      'methods', jsonb_build_array('ai', 'bbfs'),
      'digitCounts', jsonb_build_array(1, 2, 3, 4, 5, 6, 7, 8, 9),
      'learningRate', 1,
      'fixedShare', 0.02,
      'lossWeights', jsonb_build_object('pair', 0.7, 'left', 0.15, 'right', 0.15),
      'horizons', jsonb_build_array(14, 28, 56, 112)
    ),
    true
  )
  on conflict (engine_version, config_version)
  do update set config = excluded.config, is_active = true;

  return jsonb_build_object(
    'predictionId', v_prediction_id,
    'stateRevision', v_state_revision,
    'settledPredictionId', v_settled_prediction_id,
    'selectionsPublished', v_stored_selection_count,
    'selectionsSettled', v_settled_selection_count,
    'snapshotComplete', v_stored_selection_count = 18
  );
end;
$$;

commit;
