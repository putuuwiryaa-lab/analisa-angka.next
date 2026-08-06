# Adaptive Migration 008

Migration:

```text
sql/neon/008_adaptive_optimistic_concurrency.sql
```

## Masalah yang diperbaiki

Reconciliation dapat dipicu oleh ingestion, retry manual, atau fallback cron. Dua run dapat membaca state yang sama lalu menghitung secara paralel. Advisory lock lama hanya mengurutkan fase write; ia tidak membuktikan bahwa state yang dipakai saat menghitung masih merupakan state terbaru.

Tanpa guard ini, run dengan histori atau bobot lebih lama dapat memperoleh lock setelah run yang lebih baru dan menimpa `processed_history_length`, fingerprint, bobot expert, serta snapshot publikasi yang sudah maju.

## Perilaku baru

Sebelum menghitung, reconciliation menyimpan context token dari state yang dibaca:

```text
expectedStateRevision + expectedHistoryFingerprint
```

`adaptive.store_online_run(jsonb)` kemudian:

1. mengambil advisory transaction lock untuk market-target-engine-config;
2. membaca revision dan fingerprint state yang benar-benar aktif setelah lock diperoleh;
3. membandingkannya secara exact dengan context token payload;
4. menolak write menggunakan SQLSTATE `40001` bila state sudah berubah;
5. meneruskan write ke history-lineage guard migration 007 hanya ketika token masih cocok.

Token `null/null` hanya sah ketika state memang belum ada. Koreksi histori tetap aman karena context loader tetap membawa revision dan fingerprint state lama yang sengaja ditolak untuk replay, sehingga dua full replay koreksi yang tumpang tindih juga tidak dapat saling menimpa.

Run yang ditolak tidak menulis sebagian data. Reconciliation berikutnya membaca state terbaru dan menghitung ulang.

## Urutan deployment

1. Pastikan migrations 001–007 sudah aktif.
2. Deploy service/repository yang mengirim context token.
3. Jalankan migration 008 di Neon.
4. Jalankan reconciliation manual.
5. Pastikan snapshot tetap lengkap 18 selection.

Jangan menjalankan migration 008 sebelum service yang mengirim kedua field context token tersedia, karena wrapper database sengaja menolak payload lama.

Migration ini tidak mengubah rumus probabilitas, optimizer, loss, atau mekanisme pembaruan bobot. Ia hanya mencegah hasil perhitungan stale menimpa state yang lebih baru.

## Verifikasi instalasi

```sql
select
  to_regprocedure('adaptive.store_online_run(jsonb)') as public_wrapper,
  to_regprocedure('adaptive.store_online_run_revision_base(jsonb)') as migration_007_base,
  to_regprocedure('adaptive.store_online_run_base(jsonb)') as migration_005_base;
```

Ketiga kolom harus terisi.
