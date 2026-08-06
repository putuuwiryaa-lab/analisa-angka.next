# Adaptive Migration 009 — Fixed Rolling Window

## Tujuan

Market menyimpan histori dalam window tetap, misalnya 170 result. Saat result baru masuk, result terlama dibuang sehingga panjang histori tidak bertambah. Migration 009 membuat history-lineage guard menerima kondisi tersebut sebagai advance normal ketika service mengirim `rollingWindowAdvance: true`.

## Urutan deployment

Migration ini membutuhkan migration 008 dan aman diterapkan sebelum service baru karena field `rollingWindowAdvance` bersifat opsional.

1. Jalankan `sql/neon/009_adaptive_fixed_rolling_window.sql` di Neon.
2. Deploy Adaptive Service dan aplikasi dari commit yang sama.
3. Jalankan reconciliation setelah result market berubah.

## Verifikasi fungsi

```sql
select
  to_regprocedure('adaptive.store_online_run(jsonb)') as public_concurrency_wrapper,
  to_regprocedure('adaptive.store_online_run_revision_base(jsonb)') as rolling_lineage_guard,
  to_regprocedure('adaptive.store_online_run_base(jsonb)') as full_publication_base;
```

Ketiganya harus non-null.

## Verifikasi operasional

Pada reconciliation pertama setelah result berubah dan histori tetap 170, detail run harus menunjukkan:

- `rollingWindowAdvance: true`
- `replayMode: incremental`
- `processedSteps: 1`
- `settled: true`
- `selectionsSettled: 18`
- `historyCorrectionDetected: false`
- `optimisticConcurrencyChecked: true`

Dashboard kemudian berubah dari `0/100 Evaluasi` menjadi minimal `1/100 Evaluasi`, sedangkan satu prediction baru tetap berstatus pending untuk result berikutnya.
