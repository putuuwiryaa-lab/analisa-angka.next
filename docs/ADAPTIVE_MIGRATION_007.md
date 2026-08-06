# Adaptive Migration 007

Migration:

```text
sql/neon/007_cancel_corrected_history_pending.sql
```

## Masalah yang diperbaiki

Prediction pending dibentuk dari satu lineage histori tertentu. Jika result lama dikoreksi, result terakhir diganti, atau histori dipangkas, prediction tersebut tidak boleh dievaluasi menggunakan histori yang baru.

Sebelum migration 007, context engine sudah memaksa full replay ketika fingerprint berubah, tetapi row prediction pending lama masih dapat tertinggal. Pada reconciliation berikutnya row itu dapat terus dipilih, gagal diselesaikan, atau—pada kondisi tertentu—dinilai terhadap lineage yang berbeda.

## Perilaku baru

`adaptive.store_online_run(jsonb)` menjadi wrapper atomik yang:

1. mengambil advisory transaction lock untuk `market + target + engine + config`;
2. membandingkan state lama dengan prefix `historyDraws` saat ini;
3. mendeteksi pemendekan histori, perubahan cutoff, dan perubahan SHA-256 fingerprint;
4. membatalkan seluruh prediction pending dari lineage lama;
5. menghapus settlement dari payload jika koreksi terdeteksi;
6. menjalankan implementasi full-publication migration 005;
7. menyimpan fingerprint histori baru sebelum transaksi selesai.

Wrapper mengembalikan audit tambahan:

```json
{
  "historyCorrectionDetected": true,
  "pendingPredictionsCancelled": 2,
  "settlementSuppressed": true,
  "historyFingerprint": "sha256-hex"
}
```

Field return lama tetap dipertahankan.

## Urutan deployment

1. Pastikan migration 001–006 sudah diterapkan.
2. Merge perubahan repository.
3. Jalankan migration 007 pada Neon SQL Editor menggunakan koneksi direct/admin.
4. Jalankan reconciliation manual pada beberapa market.
5. Pastikan run sukses dan snapshot baru tetap memiliki `selectionsPublished: 18`.

Tidak diperlukan perubahan environment atau deploy service khusus. Service dan reconciliation tetap memanggil `adaptive.store_online_run(jsonb)` dengan kontrak yang sama.

## Verifikasi instalasi

```sql
select
  to_regprocedure('adaptive.store_online_run(jsonb)') as public_wrapper,
  to_regprocedure('adaptive.store_online_run_base(jsonb)') as full_publication_base;
```

Kedua kolom harus terisi.

Periksa tidak ada backlog pending yang lebih tua setelah reconciliation:

```sql
select
  market_id,
  target_2d,
  count(*) as pending_count,
  min(history_length) as oldest_history_length,
  max(history_length) as newest_history_length
from adaptive.predictions
where status = 'pending'
group by market_id, target_2d
having count(*) > 1
order by pending_count desc, market_id, target_2d;
```

Row ganda tidak selalu salah ketika ada backlog settlement yang valid. Setelah koreksi histori dan reconciliation selesai, prediction dari lineage lama harus berstatus `cancelled`, bukan tetap `pending`.
