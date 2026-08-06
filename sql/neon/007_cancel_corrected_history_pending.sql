begin;

create extension if not exists pgcrypto;

-- Simpan implementasi full-publication 005 sebagai fungsi dasar. Wrapper baru
-- mempertahankan nama publik adaptive.store_online_run(jsonb), sehingga service
-- dan reconciliation tidak perlu mengubah kontrak endpoint.
do $$
begin
  if to_regprocedure('adaptive.store_online_run_base(jsonb)') is null then
    if to_regprocedure('adaptive.store_online_run(jsonb)') is null then
      raise exception 'adaptive.store_online_run(jsonb) belum tersedia. Jalankan migration 005 lebih dulu.';
    end if;

    alter function adaptive.store_online_run(jsonb)
      rename to store_online_run_base;
  end if;
end;
$$;

create or replace function adaptive.store_online_run(
  p_payload jsonb
) returns jsonb
language plpgsql
as $$
declare
  v_market_id text := p_payload->>'marketId';
  v_prediction jsonb := p_payload->'prediction';
  v_target_2d text := v_prediction->>'target2D';
  v_engine_version text := v_prediction->>'engineVersion';
  v_config_version text := v_prediction->>'configVersion';
  v_history_draws jsonb := p_payload->'historyDraws';
  v_processed_history_length integer;
  v_last_processed_draw text;
  v_stored_history_fingerprint text;
  v_current_prefix text;
  v_current_prefix_last_draw text;
  v_current_prefix_fingerprint text;
  v_history_correction_detected boolean := false;
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

  -- Serialisasikan deteksi koreksi dan write prediction pada unit state yang sama.
  -- Fungsi dasar 005 mengambil lock identik; advisory xact lock re-entrant untuk
  -- transaksi yang sama.
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

  if found then
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
    -- Prediction dari lineage lama tidak boleh diselesaikan terhadap histori yang
    -- sudah dikoreksi. Batalkan seluruh pending lama sebelum fungsi dasar membuat
    -- atau mengaktifkan kembali snapshot current yang baru.
    update adaptive.predictions
    set status = 'cancelled'
    where market_id = v_market_id
      and target_2d = v_target_2d
      and engine_version = v_engine_version
      and config_version = v_config_version
      and status = 'pending';

    get diagnostics v_cancelled_pending_count = row_count;
  end if;

  v_result := adaptive.store_online_run_base(p_payload);

  return v_result || jsonb_build_object(
    'historyCorrectionDetected', v_history_correction_detected,
    'pendingPredictionsCancelled', v_cancelled_pending_count
  );
end;
$$;

commit;
