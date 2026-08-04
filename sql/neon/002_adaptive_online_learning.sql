begin;

alter table adaptive.engine_states
  add column if not exists processed_history_length integer not null default 0,
  add column if not exists last_processed_draw char(4),
  add column if not exists replay_count bigint not null default 0,
  add column if not exists learning_metrics jsonb not null default '{}'::jsonb;

alter table adaptive.predictions
  add column if not exists state_revision bigint not null default 0,
  add column if not exists weighting_mode text not null default 'foundation';

create table if not exists adaptive.replay_runs (
  id uuid primary key default gen_random_uuid(),
  market_id text not null,
  target_2d text not null check (target_2d in ('depan', 'tengah', 'belakang')),
  engine_version text not null,
  config_version text not null,
  replay_mode text not null check (replay_mode in ('full', 'incremental', 'noop')),
  start_history_length integer not null,
  end_history_length integer not null,
  processed_steps integer not null check (processed_steps >= 0),
  mean_ensemble_loss real not null default 0,
  expert_mean_losses jsonb not null default '{}'::jsonb,
  state_revision bigint not null,
  created_at timestamptz not null default now(),
  unique (
    market_id,
    target_2d,
    engine_version,
    config_version,
    end_history_length,
    replay_mode
  )
);

create index if not exists replay_runs_market_idx
  on adaptive.replay_runs (market_id, target_2d, created_at desc);

update adaptive.predictions
set status = 'cancelled'
where status = 'pending'
  and engine_version <> 'hf-apie-v1-online';

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
  v_selection jsonb := p_payload->'prediction'->'selection';
  v_settlement jsonb := p_payload->'settlement';
  v_prediction_id uuid;
  v_state_revision bigint;
  v_settled_prediction_id uuid;
  v_draw text;
  v_ordinal bigint;
begin
  if v_market_id is null or v_market_name is null or v_target_draw_key is null then
    raise exception 'Identitas online run tidak lengkap.';
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
    weighting_mode
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
    'online'
  )
  on conflict (market_id, target_draw_key, target_2d, engine_version, config_version)
  do update set
    pair_probabilities = excluded.pair_probabilities,
    left_probabilities = excluded.left_probabilities,
    right_probabilities = excluded.right_probabilities,
    expert_weights = excluded.expert_weights,
    signal_strength = excluded.signal_strength,
    state_revision = excluded.state_revision,
    weighting_mode = excluded.weighting_mode
  returning id into v_prediction_id;

  insert into adaptive.published_selections (
    prediction_id,
    method,
    digit_count,
    digits,
    estimated_success,
    baseline_success,
    lift,
    selection_margin
  ) values (
    v_prediction_id,
    v_selection->>'method',
    (v_selection->>'digitCount')::smallint,
    array(select value::smallint from jsonb_array_elements_text(v_selection->'digits')),
    (v_selection->>'estimatedSuccess')::real,
    (v_selection->>'baselineSuccess')::real,
    (v_selection->>'lift')::real,
    (v_selection->>'selectionMargin')::real
  )
  on conflict (prediction_id, method, digit_count)
  do update set
    digits = excluded.digits,
    estimated_success = excluded.estimated_success,
    baseline_success = excluded.baseline_success,
    lift = excluded.lift,
    selection_margin = excluded.selection_margin;

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
      'status', 'online-learning',
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
    'settledPredictionId', v_settled_prediction_id
  );
end;
$$;

commit;
