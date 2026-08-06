begin;

-- Migration 008 tetap menjadi public optimistic-concurrency wrapper.
-- Fungsi revision_base adalah history-lineage guard dari migration 007.
do $$
begin
  if to_regprocedure('adaptive.store_online_run_revision_base(jsonb)') is null then
    raise exception 'Migration 008 belum aktif. Jalankan migration 008 lebih dulu.';
  end if;
  if to_regprocedure('adaptive.store_online_run_base(jsonb)') is null then
    raise exception 'Migration 005 base function tidak tersedia.';
  end if;
end;
$$;

create or replace function adaptive.store_online_run_revision_base(
  p_payload jsonb
) returns jsonb
language plpgsql
as $$
declare
  v_store_payload jsonb := p_payload;
  v_market_id text := p_payload->>'marketId';
  v_prediction jsonb := p_payload->'prediction';
  v_target_2d text := v_prediction->>'target2D';
  v_engine_version text := v_prediction->>'engineVersion';
  v_config_version text := v_prediction->>'configVersion';
  v_history_draws jsonb := p_payload->'historyDraws';
  v_previous_history_draws jsonb := p_payload->'previousHistoryDraws';
  v_rolling_window_advance boolean := false;
  v_processed_history_length integer;
  v_last_processed_draw text;
  v_stored_history_fingerprint text;
  v_current_history text;
  v_current_history_fingerprint text;
  v_current_prefix text;
  v_current_prefix_last_draw text;
  v_current_prefix_fingerprint text;
  v_current_last_draw text;
  v_previous_history text;
  v_previous_history_fingerprint text;
  v_previous_last_draw text;
  v_matching_overlap_count integer := 0;
  v_rolling_overlap_valid boolean := false;
  v_rolling_latest_fallback boolean := false;
  v_history_correction_detected boolean := false;
  v_settlement_suppressed boolean := false;
  v_cancelled_pending_count integer := 0;
  v_result jsonb;
begin
  if v_market_id is null
    or v_target_2d not in ('depan', 'tengah', 'belakang')
    or v_engine_version is null
    or v_config_version is null
  then
    raise exception 'Identitas online run untuk validasi histori tidak lengkap.';
  end if;

  if jsonb_typeof(v_history_draws) <> 'array' then
    raise exception 'Online run harus membawa array historyDraws.';
  end if;
  if jsonb_array_length(v_history_draws) < 2 then
    raise exception 'Online run harus membawa minimal 2 historyDraws.';
  end if;

  if p_payload ? 'rollingWindowAdvance' then
    if jsonb_typeof(p_payload->'rollingWindowAdvance') <> 'boolean' then
      raise exception 'rollingWindowAdvance harus boolean.';
    end if;
    v_rolling_window_advance := (p_payload->>'rollingWindowAdvance')::boolean;
  end if;

  select string_agg(draw.value, '|' order by draw.ordinality)
  into v_current_history
  from jsonb_array_elements_text(v_history_draws)
    with ordinality as draw(value, ordinality);

  v_current_history_fingerprint := encode(
    digest(convert_to(coalesce(v_current_history, ''), 'UTF8'), 'sha256'),
    'hex'
  );
  v_current_last_draw := v_history_draws->>(jsonb_array_length(v_history_draws) - 1);

  perform pg_advisory_xact_lock(
    hashtextextended(
      concat_ws(
        '|',
        v_market_id,
        v_target_2d,
        v_engine_version,
        v_config_version
      ),
      0
    )
  );

  select
    processed_history_length,
    last_processed_draw,
    history_fingerprint
  into
    v_processed_history_length,
    v_last_processed_draw,
    v_stored_history_fingerprint
  from adaptive.engine_states
  where market_id = v_market_id
    and target_2d = v_target_2d
    and engine_version = v_engine_version
    and config_version = v_config_version
  limit 1;

  if v_rolling_window_advance then
    if not found then
      raise exception 'Rolling window membutuhkan engine state sebelumnya.';
    end if;
    if v_processed_history_length <> jsonb_array_length(v_history_draws) then
      raise exception 'Rolling window harus mempertahankan panjang histori yang sama.';
    end if;

    if jsonb_typeof(v_previous_history_draws) = 'array' then
      if jsonb_array_length(v_previous_history_draws) = v_processed_history_length then
        select string_agg(draw.value, '|' order by draw.ordinality)
        into v_previous_history
        from jsonb_array_elements_text(v_previous_history_draws)
          with ordinality as draw(value, ordinality);

        v_previous_history_fingerprint := encode(
          digest(convert_to(coalesce(v_previous_history, ''), 'UTF8'), 'sha256'),
          'hex'
        );
        v_previous_last_draw :=
          v_previous_history_draws->>(jsonb_array_length(v_previous_history_draws) - 1);

        select count(*) filter (
          where previous_draw.value = current_draw.value
        )::integer
        into v_matching_overlap_count
        from jsonb_array_elements_text(v_history_draws)
          with ordinality as current_draw(value, ordinality)
        join jsonb_array_elements_text(v_previous_history_draws)
          with ordinality as previous_draw(value, ordinality)
          on previous_draw.ordinality = current_draw.ordinality + 1
        where current_draw.ordinality < jsonb_array_length(v_history_draws);

        v_rolling_overlap_valid :=
          v_matching_overlap_count = v_processed_history_length - 1
          and v_previous_last_draw is not distinct from v_last_processed_draw
          and (
            v_stored_history_fingerprint is null
            or v_previous_history_fingerprint = v_stored_history_fingerprint
          );
      end if;
    end if;

    -- Backward-compatible fallback hanya untuk lineage lama yang belum memiliki
    -- previousHistoryDraws lengkap. Setelah satu run sukses, overlap menjadi
    -- bukti utama dan bekerja juga saat result 4D terbaru berulang.
    v_rolling_latest_fallback :=
      not v_rolling_overlap_valid
      and jsonb_typeof(v_previous_history_draws) is distinct from 'array'
      and v_current_last_draw is distinct from v_last_processed_draw;

    if not v_rolling_overlap_valid and not v_rolling_latest_fallback then
      raise exception 'Marker rolling window tidak cocok dengan pergeseran histori tersimpan.';
    end if;

    v_history_correction_detected := false;
  elsif found then
    if v_processed_history_length > jsonb_array_length(v_history_draws) then
      v_history_correction_detected := true;
    else
      select
        string_agg(draw.value, '|' order by draw.ordinality),
        max(draw.value) filter (
          where draw.ordinality = v_processed_history_length
        )
      into
        v_current_prefix,
        v_current_prefix_last_draw
      from jsonb_array_elements_text(v_history_draws)
        with ordinality as draw(value, ordinality)
      where draw.ordinality <= v_processed_history_length;

      if v_current_prefix_last_draw is distinct from v_last_processed_draw then
        v_history_correction_detected := true;
      elsif v_stored_history_fingerprint is not null then
        v_current_prefix_fingerprint := encode(
          digest(convert_to(coalesce(v_current_prefix, ''), 'UTF8'), 'sha256'),
          'hex'
        );
        v_history_correction_detected :=
          v_current_prefix_fingerprint is distinct from v_stored_history_fingerprint;
      end if;
    end if;
  end if;

  if v_history_correction_detected then
    update adaptive.predictions
    set status = 'cancelled'
    where market_id = v_market_id
      and target_2d = v_target_2d
      and engine_version = v_engine_version
      and config_version = v_config_version
      and status = 'pending';

    get diagnostics v_cancelled_pending_count = row_count;

    v_settlement_suppressed := coalesce(
      jsonb_typeof(v_store_payload->'settlement') = 'object',
      false
    );
    v_store_payload := jsonb_set(
      v_store_payload,
      '{settlement}',
      'null'::jsonb,
      true
    );
  end if;

  v_result := adaptive.store_online_run_base(v_store_payload);

  update adaptive.engine_states
  set
    history_fingerprint = v_current_history_fingerprint,
    updated_at = now()
  where market_id = v_market_id
    and target_2d = v_target_2d
    and engine_version = v_engine_version
    and config_version = v_config_version;

  if not found then
    raise exception 'Engine state hasil online run tidak ditemukan.';
  end if;

  return v_result || jsonb_build_object(
    'rollingWindowAdvanceAccepted', v_rolling_window_advance,
    'rollingOverlapValidated', v_rolling_overlap_valid,
    'rollingFallbackUsed', v_rolling_latest_fallback,
    'historyCorrectionDetected', v_history_correction_detected,
    'pendingPredictionsCancelled', v_cancelled_pending_count,
    'settlementSuppressed', v_settlement_suppressed,
    'historyFingerprint', v_current_history_fingerprint
  );
end;
$$;

commit;
