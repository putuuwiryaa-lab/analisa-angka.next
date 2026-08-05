# HF-APIE Adaptive Engine

Status: online-learning V1 dengan full automatic publication, settlement, guardrail, dan background reconciliation.

Adaptive berada di halaman Scan, tetapi tidak memakai formula atau state milik Scan/Batch.

## Kontrak produk

- Metode: `ai` dan `bbfs`.
- Jumlah digit: `1` sampai `9`.
- Target: `depan` (A-C), `tengah` (C-K), atau `belakang` (K-E).
- AI hit jika minimal satu digit target masuk output.
- BBFS hit jika kedua digit target masuk output.

Satu proses engine membentuk satu matriks probabilitas 100 pasangan untuk satu `market + target + cutoff histori`. Optimizer kemudian menerbitkan seluruh kombinasi berikut dari matriks yang sama:

```text
AI 1-9 digit
BBFS 1-9 digit
= 18 selection per prediction
```

Replay, pembentukan expert, dan update bobot hanya dilakukan satu kali. Optimizer penuh tidak menjalankan engine 18 kali.

## Runtime boundary

```text
Supabase markets.history_data
        ↓
Deno Adaptive service
        ↓
replay + settlement + optimizer penuh
        ↓
Neon PostgreSQL
        ↓
Next.js Adaptive UI dan Batch membaca snapshot
```

Aplikasi Next.js tidak membuka koneksi langsung ke database Adaptive. Persistence dan reconciliation dijalankan oleh service Deno pada `adaptive-service/main.mts`.

Cron service memeriksa market tertinggal setiap 15 menit. Tombol Adaptive bukan pemicu wajib pembelajaran; prediction tetap dibuat dan dievaluasi ketika tidak ada pengguna membuka halaman.

## Environment aplikasi Next.js

```env
ADAPTIVE_SERVICE_URL=https://YOUR-DENO-SERVICE.example
ADAPTIVE_SERVICE_SECRET=generate-a-long-random-secret
```

Tanpa `ADAPTIVE_SERVICE_URL`, Adaptive hanya berjalan sebagai preview dan state tidak disimpan.

## Environment service Deno

```env
NEON_DATABASE_URL=postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/DB?sslmode=require
ADAPTIVE_SERVICE_SECRET=same-secret-as-next-app
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=server-only-service-role-key
```

Koneksi Neon direct hanya digunakan untuk migration atau administrasi:

```env
NEON_DIRECT_URL=postgresql://USER:PASSWORD@HOST.REGION.aws.neon.tech/DB?sslmode=require
```

`SUPABASE_SERVICE_ROLE_KEY`, `NEON_DATABASE_URL`, dan secret service tidak boleh dikirim ke browser.

## Migration

Jalankan migration secara berurutan:

1. `sql/neon/001_adaptive_engine.sql`
2. `sql/neon/002_adaptive_online_learning.sql`
3. `sql/neon/003_adaptive_reconciliation.sql`
4. `sql/neon/004_adaptive_guardrails.sql`
5. `sql/neon/005_adaptive_full_publication.sql`

Migration 005 wajib dijalankan sebelum service dengan full publication dipakai di production. Service baru menolak hasil persistence yang tidak mengembalikan `18` published selection.

Ringkasan:

- `001`: schema, prediction, published selection, evaluation, dan engine config.
- `002`: online replay, learning state, settlement, dan `adaptive.store_online_run(jsonb)`.
- `003`: audit background reconciliation.
- `004`: fingerprint histori, drift detector, dan persistence guardrail.
- `005`: snapshot completeness, 18 published selection, 18 selection evaluation, serta audit jumlah publication/settlement.

Migration 005 membatalkan pending prediction lama yang belum mempunyai 18 selection. Reconciliation berikutnya otomatis membuat snapshot pengganti yang lengkap.

## Endpoint service

```text
GET  /health
POST /context/load
POST /runs/store
POST /predictions/store       # kompatibilitas foundation; bukan jalur online utama
POST /evaluation/dashboard
POST /guardrail/health
POST /reconcile
POST /reconciliation/latest
```

Seluruh endpoint POST membutuhkan bearer secret.

## Unit state

State dipisahkan berdasarkan:

```text
market + target2D + engineVersion + configVersion
```

Satu prediction diidentifikasi oleh state tersebut ditambah cutoff histori. Tidak ada transfer bobot antar-market atau antar-target.

## Alur online learning

```text
load histori Supabase
        ↓
validasi fingerprint state dan pending prediction
        ↓
full / incremental / noop replay
        ↓
settle pending prediction sebelumnya
        ↓
update bobot expert dari Brier loss
        ↓
bentuk satu matrix 100 pasangan
        ↓
optimizer AI 1-9 + BBFS 1-9
        ↓
atomic store online run
```

Context manual dan reconciliation sama-sama mengirim snapshot histori penuh. Koreksi result lama tidak boleh memakai state stale hanya karena panjang histori dan result terakhir masih sama.

## Loss dan update bobot

```text
70% pair Brier
15% left-position Brier
15% right-position Brier
```

```text
w' = w × exp(-1.0 × loss)
fixed-share = 2% ke prior family-balanced
normalisasi total bobot = 1
```

Bobot expert tidak dibuat terpisah untuk AI 4, BBFS 7, dan kombinasi selection lain. Bobot belajar memperbaiki matriks probabilitas bersama. Evaluasi hit dan calibration selection dipisahkan berdasarkan method dan digit count.

## Replay mode

- `full`: state tidak ada, versi berbeda, histori dipangkas, atau fingerprint tidak kompatibel.
- `incremental`: hanya result setelah `processed_history_length` yang diproses.
- `noop`: tidak ada result baru; state lama digunakan untuk menerbitkan atau memperbaiki snapshot.

Full replay dimulai setelah warmup 14 result.

## Expert V1

- Positional frequency.
- Direct 2D frequency.
- Decayed 2D frequency.
- Pair transition dengan direct-frequency backoff.
- Horizon 14, 28, 56, dan 112.
- Prior family-balanced.

## Full publication

`AdaptivePrediction` membawa:

```text
selection   = selection yang diminta caller untuk kompatibilitas UI
selections  = seluruh 18 selection kanonik
```

Sebelum write, service memvalidasi:

- array tepat 18 item;
- key `method:digitCount` unik;
- AI 1-9 dan BBFS 1-9 semuanya tersedia;
- digit berada pada 0-9 dan tidak duplikat;
- requested selection identik dengan item yang sesuai di full publication.

SQL mengulangi validasi dasar agar write tetap aman walaupun service dilewati.

## Atomic persistence

`adaptive.store_online_run(jsonb)` memakai PostgreSQL advisory transaction lock untuk satu state target. Satu transaksi mencakup:

1. sinkronisasi result snapshot;
2. update engine state;
3. insert/update prediction;
4. replace seluruh 18 published selection;
5. tandai `snapshot_complete = true` hanya setelah count tepat 18;
6. settlement matrix sebelumnya;
7. insert/update 18 selection evaluation;
8. replay audit dan engine config.

Return contract:

```json
{
  "predictionId": "uuid",
  "stateRevision": 42,
  "settledPredictionId": "uuid-or-null",
  "selectionsPublished": 18,
  "selectionsSettled": 0,
  "snapshotComplete": true
}
```

Jika ada settlement, `selectionsSettled` wajib `18`. Kesalahan di salah satu langkah menyebabkan seluruh fungsi rollback.

## Settlement

Prediction dengan `history_length = N` menargetkan result pada index berikutnya. Ketika actual result tersedia:

- pair/left/right Brier dihitung satu kali;
- expert loss dan weight change disimpan;
- seluruh 18 selection dievaluasi terhadap actual pair;
- AI memakai logika OR;
- BBFS memakai logika AND;
- prediction ditandai `settled` secara idempotent.

Tabel `adaptive.selection_evaluations` menyimpan snapshot digit, estimated success, baseline, lift, actual pair, dan hit untuk setiap method-digit count.

## Background reconciliation

Planner menjadwalkan target yang:

- belum memiliki state;
- histori berubah;
- fingerprint histori dikoreksi;
- pending prediction sudah mempunyai actual result;
- tidak mempunyai pending prediction;
- pending prediction belum memiliki 18 selection lengkap; atau
- dipaksa melalui retry admin.

Priority:

1. koreksi histori;
2. snapshot incomplete;
3. state hilang;
4. state incremental tertua.

Worker masih meminta `BBFS 7` sebagai selection utama kompatibilitas, tetapi engine selalu menghasilkan dan SQL selalu menyimpan seluruh 18 selection.

Audit reconciliation mencatat jumlah target, replay mode, prediction settled, selections published, selections settled, snapshot completeness, guardrail, dan error per target.

## Request aplikasi

```json
{
  "action": "adaptive",
  "marketId": "...",
  "method": "bbfs",
  "digitCount": 7,
  "target2D": "belakang"
}
```

Retry admin:

```json
{
  "action": "adaptive-reconcile",
  "marketLimit": 6,
  "force": false
}
```

Aksi reconciliation manual memerlukan session admin.

## Storage policy

Setiap prediction menyimpan satu matriks dan tepat 18 selection, bukan satu matriks per kombinasi. Intermediate matrix setiap expert tidak disimpan permanen. Expert loss direkonstruksi dari histori dan versi engine saat settlement.

Snapshot boleh dibaca oleh Batch hanya jika:

```text
status = pending
snapshot_complete = true
selection_count = 18
```

Filtering Batch terhadap dua indikator tersebut diterapkan pada tahap integrasi reader berikutnya.

## Deployment order

1. Apply migration 001-005 pada Neon.
2. Deploy Adaptive service.
3. Verifikasi `GET /health` menunjukkan mode `online-learning-full-publication` dan `publicationSelectionCount: 18`.
4. Jalankan reconciliation manual untuk beberapa market.
5. Pastikan setiap target menghasilkan `selectionsPublished: 18`.
6. Deploy Next.js UI/API.
7. Verifikasi Batch dan Adaptive membaca selection yang sama.

Jangan deploy service full-publication sebelum migration 005 karena write sengaja akan ditolak agar snapshot parsial tidak masuk database.

## Batas tahap ini

Tahap ini sudah mengaktifkan automatic generation, publication, settlement, dan evaluasi seluruh selection. Tahap berikutnya:

1. Batch hanya membaca snapshot complete dan menampilkan status stale/incomplete.
2. UI Adaptive menjadi read-first daripada process-first.
3. Calibration state per method-digit count menggunakan selection evaluation.
4. Normalisasi signal strength berdasarkan method dan digit count.
