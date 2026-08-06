begin;

create extension if not exists pgcrypto;

-- Migration 007 tetap menjadi implementasi dasar history-lineage guard. Wrapper
-- ini menambahkan optimistic concurrency sebelum write dilakukan.
do $$
begin
  if to_regprocedure('adaptive.store_online_run_revision_base(jsonb)') is null then
    if to_regprocedure('adaptive.store_online_run_base(jsonb)') is null then
      raise exception 'Migration 007 belum aktif. Jalankan migration 007 lebih dulu.';
    end if;
    if to_regprocedure('adaptive.store_online_run(jsonb)') is null then
      raise exception 'adaptive.store_online_run(jsonb) belum tersedia.';
    end if;

    alter function adaptive.store_online_run(jsonb)
      rename to store_online_run_revision_base;
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
  v_state jsonb := p_payload->'state';
  v_target_2d text := v_prediction->>'target2D';
  v_engine_version text := v_prediction->>'engineVersion';
  v_config_version text := v_prediction->>'configVersion';
  v_history_draws jsonb := p_payload->'historyDraws';
  v_payload_state_revision bigint;
  v_current_state_revision bigint;
  v_current_processed_history_length integer;
  v_current_last_processed_draw text;
  v_current_history_fingerprint text;
  v_payload_prefix text;
  v_payload_prefix_last_draw text;
  v_payload_prefix_fingerprint text;
  v_history_correction_at_write boolean := false;
  v_state_found boolean := false;
  v_result jsonb;
begin
  if v_market_id is null
    or v_target_2d not in ('depan', 'tengah', 'belakang')
    or v_engine_version is null
    or v_config_version is null
  then
    raise exception 'Identitas online run untuk concurrency guard tidak lengkap.';
  end if;

  if jsonb_typeof(v_history_draws) <> 'array' then
    raise exception 'Online run harus membawa array historyDraws.';
  end if;

  if coalesce(v_state->>'stateRevision', '') !~ '^[0-9]+$' then
    raise exception 'state.stateRevision wajib integer non-negatif.';
  end if;
  v_payload_state_revision := (v_state->>'stateRevision')::bigint;

  -- Lock yang sama dengan migration 005 dan 007. Setelah lock diperoleh, state
  -- yang dibaca di sini tidak dapat berubah sampai wrapper selesai.
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
    state_revision,
    processed_history_length,
    last_processed_draw,
    history_fingerprint
  into
    v_current_state_revision,
    v_current_processed_history_length,
    v_current_last_processed_draw,
    v_current_history_fingerprint
  from adaptive.engine_states
  where market_id = v_market_id
    and target_2d = v_target_2d
    and engine_version = v_engine_version
    and config_version = v_config_version
  limit 1;

  v_state_found := found;

  if not v_state_found then
    -- Run pertama selalu dihitung tanpa state tersimpan dan membawa revision 0.
    if v_payload_state_revision <> 0 then
      raise exception using
        message = 'Adaptive state berubah sebelum write: state baru tidak ditemukan tetapi payload bukan revision 0.',
        errcode = '40001';
    end if;
  else
    if v_current_processed_history_length > jsonb_array_length(v_history_draws) then
      v_history_correction_at_write := true;
    else
      select
        string_agg(draw.value, '|' order by draw.ordinality),
        max(draw.value) filter (
          where draw.ordinality = v_current_processed_history_length
        )
      into
        v_payload_prefix,
        v_payload_prefix_last_draw
      from jsonb_array_elements_text(v_history_draws)
        with ordinality as draw(value, ordinality)
      where draw.ordinality <= v_current_processed_history_length;

      if v_payload_prefix_last_draw is distinct from v_current_last_processed_draw then
        v_history_correction_at_write := true;
      elsif v_current_history_fingerprint is not null then
        v_payload_prefix_fingerprint := encode(
          digest(convert_to(coalesce(v_payload_prefix, ''), 'UTF8'), 'sha256'),
          'hex'
        );
        v_history_correction_at_write :=
          v_payload_prefix_fingerprint is distinct from v_current_history_fingerprint;
      end if;
    end if;

    if v_history_correction_at_write then
      -- Context loader membuang state lama ketika koreksi histori terdeteksi;
      -- full replay yang sah karena itu membawa revision 0. Payload non-zero
      -- berarti perhitungan awalnya memakai state lama dan menjadi stale saat
      -- menunggu write lock.
      if v_payload_state_revision <> 0 then
        raise exception using
          message = format(
            'Adaptive state berubah sebelum write: payload revision %s menjadi tidak kompatibel dengan lineage aktif revision %s.',
            v_payload_state_revision,
            v_current_state_revision
          ),
          errcode = '40001';
      end if;
    elsif v_payload_state_revision is distinct from v_current_state_revision then
      raise exception using
        message = format(
          'Adaptive state berubah sebelum write: expected revision %s, observed revision %s.',
          v_payload_state_revision,
          v_current_state_revision
        ),
        errcode = '40001';
    end if;
  end if;

  -- Migration 007 mengambil advisory lock yang sama; lock bersifat re-entrant
  -- dalam transaksi ini dan tetap menjaga pembatalan lineage lama secara atomik.
  v_result := adaptive.store_online_run_revision_base(p_payload);

  return v_result || jsonb_build_object(
    'optimisticConcurrencyChecked', true,
    'payloadStateRevision', v_payload_state_revision,
    'observedStateRevision', v_current_state_revision,
    'historyCorrectionAtWrite', v_history_correction_at_write
  );
end;
$$;

commit;
