# HF-APIE Adaptive Engine V2

Status: production online-learning untuk **2D belakang** dengan automatic publication, settlement, independent selection calibration, guardrail, dan reconciliation.

Kontrak aktif:

```text
engineVersion  = hf-apie-v2-back
configVersion  = 2026-08-08.1
target         = belakang
maxHistory     = 170
replayWarmup   = 28
expertCount    = 28
AI             = 1..6 digit
BBFS           = 5..9 digit
selectionCount = 11
```

## Runtime boundary

```text
Render scraper (repo putuuwiryaa-lab/backup-)
        ↓
Supabase markets.history_data
        ↓
POST adaptive-engine-service /reconcile
        ↓
Deno Adaptive service
        ↓
replay / settlement / calibration / optimizer
        ↓
Neon PostgreSQL
        ↓
Next.js Adaptive UI membaca published snapshot
```

Aplikasi Next.js bersifat read-first untuk Adaptive. Membuka atau me-refresh halaman tidak menjalankan learning dan tidak mengubah bobot.

## Workload Deno

Repository yang sama mempunyai dua workload production:

1. `analisaangka-next`
   - branch: `main`
   - application directory: `/`
   - Next.js UI dan API.

2. `adaptive-engine-service`
   - branch: `main`
   - application directory: `adaptive-service/`
   - entrypoint: `main.mts`
   - engine, persistence, evaluation, guardrail, snapshot reader, dan reconciliation.

## Environment

Next.js application:

```env
ADAPTIVE_SERVICE_URL=
ADAPTIVE_SERVICE_SECRET=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Adaptive service:

```env
NEON_DATABASE_URL=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ADAPTIVE_SERVICE_SECRET=
ADAPTIVE_FALLBACK_CRON_ENABLED=false
```

Scraper Render pada repo `putuuwiryaa-lab/backup-` juga menggunakan `ADAPTIVE_SERVICE_URL` dan `ADAPTIVE_SERVICE_SECRET` untuk memicu `/reconcile` setelah ingestion selesai.

## Target dan output production

V2 hanya membuat prediction untuk `2D belakang` (K-E). Result tetap dibaca sebagai 4D penuh sehingga AS/KOP masih boleh menjadi feature expert structural, tetapi bukan target publication.

Prediction membawa tepat 11 selection:

```text
AI1
AI2
AI3
AI4
AI5
AI6
BBFS5
BBFS6
BBFS7
BBFS8
BBFS9
```

AI hit jika minimal satu digit actual belakang berada pada selection. BBFS hit jika kedua digit actual belakang berada pada selection.

## Histori rolling 170

Supabase mempertahankan maksimal 170 result. Rolling normal berbentuk:

```text
lama : R1 ... R170
baru : R2 ... R171
```

Array baru tetap berukuran 170. Reconciliation memvalidasi overlap 169 item dan membawa exact previous 170-result window ketika melakukan settlement. Jika previous window tidak valid/tersedia pada jalur rolling, sistem tidak boleh menebak konteks learning.

Koreksi histori diperlakukan sebagai recovery path dan dapat menyebabkan pending dibatalkan serta full replay.

## Replay

Warmup V2 adalah 28 result.

Mode:

- `full`: state belum ada, config/engine berubah, atau histori tidak kompatibel;
- `incremental`: satu actual baru diproses dari state valid;
- `noop`: tidak ada evidence baru.

Full replay bersifat prequential. Untuk actual pada index `t`, expert hanya boleh melihat histori sebelum `t`; tidak ada future leakage.

## 28 expert

Ensemble V2 mencakup family berikut:

- uniform/null baseline;
- positional frequency;
- direct pair frequency;
- Bayesian pair;
- fixed/adaptive decay;
- hierarchical pair transition;
- self/cross/lagged position Markov;
- digit dan pair gap/recurrence;
- repeat/switch;
- distribution momentum;
- adaptive regime window;
- cross-position structural;
- previous-4D conditional / Naive Bayes;
- lagged position interaction;
- variable-order KEPALA, EKOR, dan pair context.

Base horizon adalah `21 / 42 / 85 / 170`. History expert tidak boleh melewati reservoir 170.

Prior dibuat family-balanced. Null expert dipertahankan sebagai control/baseline.

## Dua lapis learning

Adaptive memakai dua lapis bobot yang berbeda.

### 1. Global expert weights

Global weights mengkalibrasi matriks probabilitas 100 pair. Global weights tetap belajar pada **setiap actual result**, karena tugasnya menilai kualitas distribusi probabilitas keseluruhan, bukan status win/loss satu selection.

Loss global:

```text
70% pair Brier
15% left-position Brier
15% right-position Brier
```

Update:

```text
posterior ∝ weight_before × exp(-loss)
fixed-share = 2% ke baseline
normalisasi total = 1
```

### 2. Independent selection calibration

Masing-masing 11 kombinasi `method + digitCount` memiliki calibration state dan expert weights sendiri.

Policy config `2026-08-08.1`:

```text
WIN
  -> tetap hitung/catat hit, confidence, calibration loss, dan expert losses untuk audit
  -> weightsAfter = weightsBefore
  -> calibration weights DIBEKUKAN

MISS
  -> hitung expert losses
  -> updateExpertWeights(...)
  -> calibration weights DIREKALIBRASI
```

Artinya BBFS7 MISS hanya merecalibrate BBFS7. Jika BBFS8 WIN pada actual yang sama, bobot BBFS8 tidak disentuh. AI selection lain juga memiliki state independen.

State revision, sample count, hit count, dan cumulative calibration loss tetap bergerak pada WIN maupun MISS karena keduanya adalah data evaluasi. Yang dibekukan saat WIN hanya calibration weights.

Policy WIN-freeze juga dipakai dalam historical prequential bootstrap agar state awal dan live behavior memakai aturan yang sama.

## Publication dan settlement

Prediction baru dibuat setelah learning dari evidence yang tersedia selesai, lalu snapshot prediction dibekukan.

```text
state/history saat ini
  -> bangun expert
  -> global/selection weights yang sudah valid
  -> optimizer 11 selection
  -> publish prediction
  -> tunggu actual baru
```

Prediction yang sudah published tidak dituning ulang hanya karena `/reconcile` dipanggil lagi. Tanpa actual baru, replay normal adalah `noop`.

Ketika actual baru masuk:

```text
pending prediction
  + actual
  -> settle
  -> global expert update
  -> per-selection:
       WIN  = freeze
       MISS = recalibrate
  -> publish prediction berikutnya
```

## Persistence

Supabase adalah source histori. Neon menyimpan:

- engine state;
- result snapshot/fingerprint;
- pending dan settled prediction;
- 11 published selections;
- independent calibration metadata;
- settlement/evaluation;
- guardrail state;
- reconciliation audit.

State scope:

```text
market + target2D + engineVersion + configVersion
```

Config version dipakai untuk mencegah state dari rule learning berbeda tercampur.

## Migration

Jalankan migration Neon berurutan:

1. `001_adaptive_engine.sql`
2. `002_adaptive_online_learning.sql`
3. `003_adaptive_reconciliation.sql`
4. `004_adaptive_guardrails.sql`
5. `005_adaptive_full_publication.sql`
6. `006_retire_legacy_prediction.sql`
7. `007_cancel_corrected_history_pending.sql`
8. `008_adaptive_optimistic_concurrency.sql`
9. `009_adaptive_fixed_rolling_window.sql`
10. `010_independent_selection_calibration.sql`
11. `011_adaptive_v2_back_only.sql`
12. `012_freeze_selection_weights_on_win.sql`

Migration 011 mengaktifkan contract V2 back-only/11-selection. Migration 012 mengaktifkan config `2026-08-08.1`, memisahkan audit dari config sebelumnya, dan menandai policy selection `WIN=freeze`, `MISS=recalibrate`.

## Endpoint service

Service entrypoint: `adaptive-service/main.mts`.

Endpoint utama:

```text
GET/POST service handler sesuai route
POST /context/load
POST /runs/store
POST /snapshots/batch
POST /evaluation/dashboard
POST /guardrail/health
POST /reconcile
POST /reconciliation/latest
```

Endpoint private menggunakan bearer `ADAPTIVE_SERVICE_SECRET`.

## Reconciliation

Primary trigger datang dari scraper Render di repository `putuuwiryaa-lab/backup-`:

```text
scrape
  -> evaluator/statistics
  -> trigger_adaptive_reconciliation.py
  -> /reconcile
```

Fallback cron Deno hanya aktif jika:

```env
ADAPTIVE_FALLBACK_CRON_ENABLED=true
```

Reconciliation hanya memproses target `belakang`. Snapshot dianggap lengkap jika tepat 11 selection V2 tersedia.

## Deployment order untuk perubahan config

Urutan aman:

```text
1. apply migration Neon
2. deploy adaptive-engine-service dan aplikasi dari commit yang sama
3. jalankan reconciliation
4. full replay/bootstrap config baru
5. verifikasi 11 publication + 11 calibration states
6. biarkan scraper berikutnya menjalankan incremental settlement normal
```

Jangan mencampur service dengan config baru dan database yang belum menerima config tersebut.

## Prinsip audit

- Prediction yang sudah published adalah immutable evidence untuk settlement berikutnya.
- `weightsBefore`, expert losses, dan `weightsAfter` disimpan/dapat diaudit pada settlement.
- Pada selection WIN, `weightsAfter` harus identik dengan `weightsBefore`.
- Pada selection MISS, recalibration boleh mengubah weights.
- Global weights tetap boleh berubah pada actual yang sama karena global learning mempunyai objective probabilistik berbeda.

Adaptive adalah statistical online-learning ensemble. Perubahan bobot atau hit historis bukan jaminan adanya predictive edge pada result berikutnya.
