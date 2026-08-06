# Adaptive Migration 008

Migration:

```text
sql/neon/008_adaptive_optimistic_concurrency.sql
```

## Masalah yang diperbaiki

Reconciliation dapat dipicu oleh ingestion, retry manual, atau fallback cron. Dua run dapat membaca state yang sama lalu menghitung secara paralel. Advisory lock lama hanya mengurutkan fase write; ia tidak membuktikan bahwa state yang dipakai saat menghitung masih merupakan state terbaru.

Tanpa guard ini, run dengan histori atau bobot lebih lama dapat memperoleh lock setelah run yang lebih baru dan menimpa `processed_history_length`, fingerprint, bobot expert, serta snapshot publikasi yang sudah maju.

## Perilaku baru

`adaptive.store_online_run(jsonb)` memeriksa state sekali lagi setelah memperoleh advisory transaction lock:

1. payload normal/incremental harus membawa `state.stateRevision` yang sama dengan state aktif;
2. run pertama hanya boleh membawa revision `0` ketika state belum ada;
3. payload yang awalnya memakai state lama tetapi menjadi tidak kompatibel saat menunggu lock ditolak dengan SQLSTATE `40001`;
4. full replay koreksi histori yang sah tetap diperbolehkan karena context loader memang membuang state lama dan menghasilkan revision `0`;
5. migration 007 tetap menangani pembatalan pending lineage lama dan fingerprint secara atomik.

Run yang ditolak tidak menulis sebagian data. Reconciliation berikutnya membaca state terbaru dan menghitung ulang.

## Urutan deployment

1. Pastikan migrations 001–007 sudah aktif.
2. Merge kode repository.
3. Jalankan migration 008 di Neon.
4. Jalankan reconciliation manual.
5. Pastikan snapshot tetap lengkap 18 selection.

Migration ini tidak mengubah rumus probabilitas, optimizer, loss, atau mekanisme pembaruan bobot. Ia hanya mencegah hasil perhitungan stale menimpa state yang lebih baru.

## Verifikasi instalasi

```sql
select
  to_regprocedure('adaptive.store_online_run(jsonb)') as public_wrapper,
  to_regprocedure('adaptive.store_online_run_revision_base(jsonb)') as migration_007_base,
  to_regprocedure('adaptive.store_online_run_base(jsonb)') as migration_005_base;
```

Ketiga kolom harus terisi.
