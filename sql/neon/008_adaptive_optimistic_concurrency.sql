begin;

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
  v_target_2d text := v_prediction->>'target2D';
  v_engine_version text := v_prediction->>'engineVersion';
  v_config_version text := v_prediction->>'configVersion';
  v_expected_state_revision bigint;
  v_expected_history_fingerprint text;
  v_current_state_revision bigint;
  v_current_history_fingerprint text;
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

  if not (p_payload ? 'expectedStateRevision')
    or not (p_payload ? 'expectedHistoryFingerprint')
  then
    raise exception 'Online run harus membawa expected state revision dan fingerprint.';
  end if;

  if jsonb_typeof(p_payload->'expectedStateRevision') = 'null' then
    v_expected_state_revision := null;
  elsif jsonb_typeof(p_payload->'expectedStateRevision') = 'number'
    and (p_payload->>'expectedStateRevision') ~ '^[0-9]+$'
  then
    v_expected_state_revision := (p_payload->>'expectedStateRevision')::bigint;
  else
    raise exception 'expectedStateRevision harus null atau integer non-negatif.';
  end if;

  if jsonb_typeof(p_payload->'expectedHistoryFingerprint') = 'null' then
    v_expected_history_fingerprint := null;
  elsif jsonb_typeof(p_payload->'expectedHistoryFingerprint') = 'string'
    and (p_payload->>'expectedHistoryFingerprint') ~ '^[0-9a-f]{64}$'
  then
    v_expected_history_fingerprint := p_payload->>'expectedHistoryFingerprint';
  else
    raise exception 'expectedHistoryFingerprint harus null atau SHA-256 hex.';
  end if;

  -- Lock yang sama dengan migration 005 dan 007. Context token dibandingkan
  -- setelah lock diperoleh, sehingga state tidak dapat berubah di antara check
  -- dan write.
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
    history_fingerprint
  into
    v_current_state_revision,
    v_current_history_fingerprint
  from adaptive.engine_states
  where market_id = v_market_id
    and target_2d = v_target_2d
    and engine_version = v_engine_version
    and config_version = v_config_version
  limit 1;

  v_state_found := found;

  if v_state_found then
    if v_expected_state_revision is distinct from v_current_state_revision
      or v_expected_history_fingerprint is distinct from v_current_history_fingerprint
    then
      raise exception using
        message = format(
          'Adaptive state berubah sebelum write: expected revision/fingerprint %s/%s, observed %s/%s.',
          coalesce(v_expected_state_revision::text, 'null'),
          coalesce(v_expected_history_fingerprint, 'null'),
          coalesce(v_current_state_revision::text, 'null'),
          coalesce(v_current_history_fingerprint, 'null')
        ),
        errcode = '40001';
    end if;
  elsif v_expected_state_revision is not null
    or v_expected_history_fingerprint is not null
  then
    raise exception using
      message = 'Adaptive state berubah sebelum write: context mengharapkan state yang tidak lagi tersedia.',
      errcode = '40001';
  end if;

  -- Migration 007 mengambil advisory lock yang sama; lock bersifat re-entrant
  -- dalam transaksi ini dan tetap menjaga pembatalan lineage lama secara atomik.
  v_result := adaptive.store_online_run_revision_base(p_payload);

  return v_result || jsonb_build_object(
    'optimisticConcurrencyChecked', true,
    'expectedStateRevision', v_expected_state_revision,
    'observedStateRevision', v_current_state_revision,
    'expectedHistoryFingerprint', v_expected_history_fingerprint,
    'observedHistoryFingerprint', v_current_history_fingerprint
  );
end;
$$;

commit;
