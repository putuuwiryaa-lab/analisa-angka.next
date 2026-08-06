begin;

-- Prediction V1 hanya menerbitkan satu selection. Jika masih pending, prediction
-- tersebut tidak dapat diselesaikan oleh kontrak publication V2 yang mewajibkan
-- tepat 18 selection. Batalkan seluruh snapshot tidak lengkap agar reconciliation
-- dapat menerbitkan ulang snapshot lengkap.
update adaptive.predictions p
set
  status = 'cancelled',
  settled_at = coalesce(p.settled_at, now())
where p.status = 'pending'
  and (
    p.snapshot_complete is not true
    or p.selection_count <> 18
    or (
      select count(*)
      from adaptive.published_selections s
      where s.prediction_id = p.id
    ) <> 18
  );

-- Jalur penulisan V1 tidak boleh tersedia lagi setelah full publication aktif.
drop function if exists adaptive.store_prediction(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  text,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  text,
  text,
  smallint,
  jsonb,
  real,
  real,
  real,
  real
);

commit;
