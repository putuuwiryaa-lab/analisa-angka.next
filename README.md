# Analisa Angka

Analisa Angka adalah aplikasi web/PWA berbasis Next.js untuk dashboard pasaran, analisa angka, Scan, statistik, evaluasi, rekomendasi Invest 2D, Angka Jadi, dan Adaptive Learning.

## Stack

| Area | Teknologi |
|---|---|
| Runtime aplikasi | Deno Deploy |
| Adaptive service | Deno Deploy |
| Framework | Next.js App Router |
| UI | React dan Tailwind CSS |
| Bahasa | TypeScript |
| Source histori market | Supabase PostgreSQL |
| State/prediction/audit Adaptive | Neon PostgreSQL |
| State data UI | TanStack React Query |
| Scraper production | Render, dari repository `putuuwiryaa-lab/backup-` |

Repository `analisa-angka.next` sendiri tidak memiliki konfigurasi Vercel atau Render. Aplikasi dan `adaptive-engine-service` dideploy melalui Deno Deploy. Render hanya dipakai oleh pipeline scraper eksternal di repository `putuuwiryaa-lab/backup-`.

## Fitur

- Dashboard dan pencarian pasaran.
- Histori result market.
- Angka Ikut, BBFS, Angka Mati, Jumlah Mati, Shio Mati, dan Custom Rekap.
- Scan dan Batch Scan.
- Adaptive Learning V2 untuk 2D belakang.
- Statistik, evaluasi Adaptive, dan guardrail health.
- Rekomendasi Invest 2D dan Angka Jadi.
- PWA dan service worker.
- Sistem PIN 8 digit serta panel admin untuk generate/revoke akses.

## Arsitektur Adaptive Learning V2

Adaptive production saat ini menggunakan:

```text
engineVersion = hf-apie-v2-back
configVersion = 2026-08-07.1
target        = 2D belakang
maxHistory    = 170
replayWarmup  = 28
expertCount   = 28
selection     = AI1-AI6 + BBFS5-BBFS9
selectionCount = 11
```

Target prediction hanya **2D belakang**. Digit AS/KOP tetap dapat dipakai sebagai feature oleh expert structural karena source result tetap berupa 4D penuh.

### Source data dan scraper

Scraper production dan otomatisasi yang memperbarui histori market berada di repository:

[`putuuwiryaa-lab/backup-`](https://github.com/putuuwiryaa-lab/backup-)

Pipeline Render pada repo tersebut menjalankan scraper dan evaluator, lalu stage `trigger_adaptive_reconciliation.py` memanggil endpoint `/reconcile` pada `adaptive-engine-service`.

Alur production:

```text
Render scraper (repo backup-)
  -> update history_data di Supabase
  -> evaluator/statistics
  -> trigger_adaptive_reconciliation.py
  -> adaptive-engine-service /reconcile
  -> replay/settlement/update weights
  -> simpan state + prediction + audit ke Neon
  -> UI analisa-angka.next membaca published snapshot
```

UI Adaptive bersifat **read-first**: request user membaca snapshot yang sudah dipublish. Request normal dari UI tidak melakukan recompute atau learning write.

### Histori rolling 170

Supabase mempertahankan maksimal 170 result per market. Saat result baru masuk, result terlama dibuang sehingga panjang histori tetap 170.

Secara konseptual:

```text
window lama : R1 ... R170
window baru : R2 ... R171
```

Label `R171` di atas hanya menunjukkan urutan result baru; source array tetap berisi maksimal 170 item.

Rolling normal divalidasi melalui overlap 169 result. Pending prediction dievaluasi memakai exact previous history window yang melahirkan prediction tersebut, sehingga settlement tidak belajar dari konteks histori yang salah. Koreksi histori diperlakukan berbeda dari rolling normal dan dapat memicu recovery/full replay.

### Bootstrap dan online learning

1. **Bootstrap / full replay**
   - Dipakai saat state V2 belum tersedia, tidak kompatibel, versi/config berubah, atau histori dikoreksi.
   - Warmup awal adalah 28 result.
   - Replay berjalan prequential: prediction untuk result ke-`t` hanya boleh menggunakan histori sebelum result `t`.
   - Global expert weights dan 11 independent selection calibration state dibootstrap dari histori yang tersedia.

2. **Operasi normal**
   - Full replay tidak dijalankan setiap result.
   - Result baru menyelesaikan pending prediction sebelumnya.
   - Global expert weights diperbarui satu langkah.
   - Masing-masing dari 11 selection memperbarui calibration state-nya sendiri.
   - Prediction berikutnya dipublish sebagai snapshot baru.

3. **Optimistic concurrency dan lineage**
   - State memakai `stateRevision` dan history fingerprint untuk menolak stale write.
   - Fixed rolling window dibedakan dari koreksi histori.
   - Pending dari lineage histori yang tidak kompatibel tidak boleh disettle sebagai prediction valid.

### Expert ensemble

Adaptive V2 memakai 28 expert yang sengaja dibuat lebih beragam, bukan sekadar menggandakan model yang sama pada banyak horizon.

Family utama mencakup:

- uniform/null baseline;
- positional frequency;
- direct pair frequency;
- Bayesian pair shrinkage;
- fixed dan adaptive recency/decay;
- hierarchical pair transition;
- position/self/cross Markov;
- digit/pair recurrence dan gap hazard;
- repeat/switch behavior;
- distribution momentum;
- adaptive regime/window;
- cross-position/full-4D structural expert;
- variable-order digit dan pair context.

Base horizon V2 adalah `21 / 42 / 85 / 170`, tetapi tidak semua expert diwajibkan memakai keempat horizon. Expert recurrence, structural, context, recency, dan regime dapat memakai reservoir atau effective window sesuai karakter modelnya.

Bobot awal tetap family-balanced agar family dengan lebih banyak varian tidak otomatis mendominasi hanya karena jumlah expert-nya lebih banyak. Null expert dipertahankan sebagai control/baseline.

### Output production

V2 hanya mempublikasikan 11 selection:

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

AI7-AI9 dipensiunkan karena coverage terlalu longgar, sedangkan BBFS1-BBFS4 dipensiunkan karena terlalu ketat untuk production use case.

Setiap kombinasi `method + digitCount` mempunyai calibration state dan expert weights sendiri. Contoh: miss pada BBFS7 memperbarui BBFS7, bukan BBFS8 atau AI6.

### Persistence dan migration

- Supabase adalah source histori market.
- Neon menyimpan Adaptive state, pending/published prediction, selection, settlement, evaluation, guardrail, reconciliation run, dan audit terkait.
- Migration V2 berada di `sql/neon/011_adaptive_v2_back_only.sql`.
- Migration 011 mempertahankan settled history V1 untuk audit, membatalkan pending V1, dan mengaktifkan config V2.
- Snapshot V2 dianggap lengkap hanya jika membawa tepat 11 selection yang valid.

## Otomatisasi reconciliation

Primary trigger reconciliation adalah pipeline scraper di repo `putuuwiryaa-lab/backup-`.

Setelah scraper selesai, `trigger_adaptive_reconciliation.py` memanggil `/reconcile` berulang sampai backlog `remainingMarkets` habis atau batas round tercapai. Script eksternal tidak mengunci detail AI/BBFS atau target; contract V2 ditentukan oleh `adaptive-engine-service` di repository ini.

`adaptive-service/crons.mts` juga menyediakan fallback cron Deno yang hanya aktif bila:

```env
ADAPTIVE_FALLBACK_CRON_ENABLED=true
```

Tanpa flag tersebut, service menunggu trigger dari ingestion/scraper.

## Sistem akses

Sistem akses memakai tabel Supabase berikut:

```text
analisa_access_pins
analisa_access_sessions
analisa_rate_limits
```

PIN, session token, dan IP disimpan dalam bentuk hash HMAC menggunakan `ACCESS_SECRET`. Cookie user dan admin bersifat `httpOnly`, `sameSite=lax`, serta `secure` pada production.

Temporary PIN bypass Deno berakhir pada **7 Agustus 2026 pukul 17.08 WITA**. Setelah waktu tersebut, `isTemporaryPinBypassActive()` otomatis bernilai false dan proteksi PIN kembali berlaku. Autentikasi admin tetap terpisah.

## Environment variables

### Next.js application

Public, tersedia pada Build, Production, dan Development:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_ADMIN_CONTACT_URL=
```

Server-only:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ACCESS_SECRET=
ADMIN_PASSWORD=
INTERNAL_API_SECRET=
ADAPTIVE_SERVICE_URL=
ADAPTIVE_SERVICE_SECRET=
```

`ADAPTIVE_SERVICE_URL` menunjuk ke deployment `adaptive-engine-service`. `ADAPTIVE_SERVICE_SECRET` harus sama pada caller dan service.

### adaptive-engine-service

```env
NEON_DATABASE_URL=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ADAPTIVE_SERVICE_SECRET=
ADAPTIVE_FALLBACK_CRON_ENABLED=false
```

`NEON_DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, dan `ADAPTIVE_SERVICE_SECRET` diperlukan untuk reconciliation production. Fallback cron bersifat opsional.

### Scraper Render (`putuuwiryaa-lab/backup-`)

Pipeline scraper membutuhkan environment yang mencakup:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
APP_BASE_URL=
INTERNAL_API_SECRET=
ADAPTIVE_SERVICE_URL=
ADAPTIVE_SERVICE_SECRET=
ADAPTIVE_RECONCILE_MARKET_LIMIT=
ADAPTIVE_RECONCILE_MAX_ROUNDS=
```

Jangan commit credential asli dan jangan expose service-role key atau service secret ke browser.

## Pengembangan dengan Deno

```bash
deno install --allow-scripts
deno task dev
deno task typecheck
deno task lint
deno task build
```

Dependency utama dipin ke versi exact. Jangan mengubahnya menjadi rentang `^` tanpa menjalankan build Deno Deploy, karena builder Deno tidak menggunakan lockfile pnpm.

## Deployment

Repository ini mempunyai dua workload Deno yang harus menggunakan source/config versi yang kompatibel:

1. **Next.js application**
   - branch production: `main`
   - application directory: `/`
   - framework: `nextjs`
   - install: `deno install --allow-scripts`
   - build: `deno task build`

2. **adaptive-engine-service**
   - menjalankan service pada `adaptive-service/`
   - memerlukan Neon + Supabase + service secret
   - menangani snapshot, evaluation, guardrail, storage, dan reconciliation

Untuk perubahan contract Adaptive yang membutuhkan schema baru, urutan rollout yang aman adalah:

```text
migration Neon
  -> merge/deploy app + adaptive-engine-service
  -> reconciliation/bootstrap
  -> verifikasi published snapshot
```

Panduan Deno tersedia di [`docs/DENO_DEPLOY.md`](docs/DENO_DEPLOY.md). Dokumentasi Adaptive lebih rinci berada di [`docs/ADAPTIVE_ENGINE.md`](docs/ADAPTIVE_ENGINE.md).

## Struktur penting

```text
app/                    Next.js routes dan API
components/             UI, analysis, layout, PWA
lib/analysis/           engine analisa non-Adaptive
lib/adaptive/           Adaptive client/read-path + mirrored core utilities
lib/server/             akses, Supabase admin, rate limit
adaptive-service/       Adaptive persistence, reconciliation, evaluation, guardrail
sql/neon/               migration schema/state Adaptive
proxy.ts                proteksi route, canonical redirect, PIN access
deno.json               task dan konfigurasi Deno Deploy
```

External production scraper:

```text
putuuwiryaa-lab/backup-
  render_scraper_job.py
  trigger_adaptive_reconciliation.py
  render.yaml
```

## Catatan

Adaptive V2 adalah statistical online-learning ensemble, bukan neural network/deep-learning model. Engine menghasilkan probabilitas relatif dari histori dan mengevaluasi dirinya secara prequential; perubahan bobot tidak dengan sendirinya membuktikan adanya predictive edge.

Aplikasi ini adalah alat bantu analisa berbasis data historis dan evaluasi sistem. Hasil analisa bukan jaminan hasil akhir.
