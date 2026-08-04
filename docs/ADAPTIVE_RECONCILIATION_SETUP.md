# Adaptive Reconciliation Setup

Fase reconciliation menambahkan cron Deno Deploy setiap 15 menit dan retry manual dari UI Adaptive.

## Environment tambahan pada adaptive-engine-service

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
```

Gunakan URL project Supabase yang sama dengan aplikasi utama. Service role key hanya dipasang pada service Deno dan tidak boleh dikirim ke browser.

Environment yang sudah ada tetap diperlukan:

```env
NEON_DATABASE_URL=postgresql://...
ADAPTIVE_SERVICE_SECRET=...
```

## Migration

Jalankan setelah migration 001 dan 002:

```text
sql/neon/003_adaptive_reconciliation.sql
```

Migration membuat `adaptive.reconciliation_runs` untuk audit cron dan retry manual.

## Cron

```text
Nama     : adaptive-market-reconciliation
Jadwal   : */15 * * * *
Zona     : UTC
Batch    : 4 market per eksekusi
Retry    : 1 menit, 5 menit, 15 menit
```

Worker hanya memilih market/target yang:

- belum memiliki state;
- panjang histori berbeda;
- result terakhir berbeda; atau
- memiliki pending prediction yang sudah mendapat actual result.

Semua write tetap idempotent melalui `adaptive.store_online_run(jsonb)`.

## Retry admin

Tab Adaptive menyediakan tombol `Reconcile 6 Market · Admin`. Endpoint tetap memakai `POST /api/scan` dengan payload:

```json
{
  "action": "adaptive-reconcile",
  "marketLimit": 6
}
```

Aksi membutuhkan session admin.
