begin;

alter table adaptive.engine_states
  add column if not exists history_fingerprint text;

create unique index if not exists drift_events_prediction_transition_idx
  on adaptive.drift_events (
    prediction_id,
    next_state
  )
  where prediction_id is not null;

create or replace function adaptive.persist_guardrail(
  p_payload jsonb
) returns jsonb
language plpgsql
as $$
declare
  v_market_id text := p_payload->>'marketId';
  v_target_2d text := p_payload->>'target2D';
  v_engine_version text := p_payload->>'engineVersion';
  v_config_version text := p_payload->>'configVersion';
  v_target_draw_key text := p_payload->>'targetDrawKey';
  v_settled_prediction_id uuid;
  v_history_fingerprint text := p_payload->>'historyFingerprint';
  v_previous_state text := coalesce(p_payload->>'previousState', 'stable');
  v_next_state text := coalesce(p_payload->>'nextState', 'stable');
  v_event_type text := p_payload->>'eventType';
  v_detector_state jsonb := coalesce(p_payload->'detectorState', '{}'::jsonb);
  v_current_prediction_id uuid;
begin
  if v_market_id is null
    or v_target_2d not in ('depan', 'tengah', 'belakang')
    or v_engine_version is null
    or v_config_version is null
    or v_target_draw_key is null
  then
    raise exception 'Payload guardrail tidak lengkap.';
  end if;

  if v_previous_state not in ('stable', 'warning', 'drift', 'recovery')
    or v_next_state not in ('stable', 'warning', 'drift', 'recovery')
  then
    raise exception 'State drift tidak valid.';
  end if;

  if v_event_type is not null
    and v_event_type not in ('stable', 'warning', 'drift', 'recovery')
  then
    raise exception 'Event drift tidak valid.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      concat_ws(
        '|',
        v_market_id,
        v_target_2d,
        v_engine_version,
        v_config_version,
        'guardrail'
      ),
      0
    )
  );

  update adaptive.engine_states
  set
    drift_state = v_next_state,
    detector_state = v_detector_state,
    history_fingerprint = v_history_fingerprint,
    updated_at = now()
  where market_id = v_market_id
    and target_2d = v_target_2d
    and engine_version = v_engine_version
    and config_version = v_config_version;

  if not found then
    raise exception 'Engine state guardrail tidak ditemukan.';
  end if;

  update adaptive.predictions
  set drift_state = v_next_state
  where market_id = v_market_id
    and target_draw_key = v_target_draw_key
    and target_2d = v_target_2d
    and engine_version = v_engine_version
    and config_version = v_config_version
  returning id
  into v_current_prediction_id;

  if nullif(p_payload->>'settledPredictionId', '') is not null then
    v_settled_prediction_id := (p_payload->>'settledPredictionId')::uuid;

    update adaptive.evaluations
    set
      drift_before = v_previous_state,
      drift_after = v_next_state
    where prediction_id = v_settled_prediction_id;

    if v_event_type is not null then
      insert into adaptive.drift_events (
        market_id,
        target_2d,
        prediction_id,
        event_type,
        previous_state,
        next_state,
        detector_data
      ) values (
        v_market_id,
        v_target_2d,
        v_settled_prediction_id,
        v_event_type,
        v_previous_state,
        v_next_state,
        v_detector_state || jsonb_build_object(
          'historyFingerprint', v_history_fingerprint,
          'currentPredictionId', v_current_prediction_id,
          'guardrailMode', 'observe-only'
        )
      )
      on conflict (
        prediction_id,
        next_state
      ) where prediction_id is not null
      do update set
        event_type = excluded.event_type,
        previous_state = excluded.previous_state,
        detector_data = excluded.detector_data;
    end if;
  end if;

  return jsonb_build_object(
    'currentPredictionId', v_current_prediction_id,
    'settledPredictionId', v_settled_prediction_id,
    'historyFingerprint', v_history_fingerprint,
    'previousState', v_previous_state,
    'nextState', v_next_state,
    'eventType', v_event_type
  );
end;
$$;

commit;
