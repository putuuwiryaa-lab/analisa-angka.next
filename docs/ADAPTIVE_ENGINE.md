# HF-APIE Adaptive Engine

Status: online-learning V1 dengan background reconciliation.

Adaptive berada di halaman Scan sebagai tab ketiga, tetapi tidak memakai formula atau state milik Scan/Batch.

## Kontrak produk

- Metode: `ai` atau `bbfs`
- Jumlah digit: `1` sampai `9`
- Target: `depan` (A-C), `tengah` (C-K), atau `belakang` (K-E)
- AI berhasil jika minimal satu digit target masuk output.
- BBFS berhasil jika kedua digit target masuk output.

Engine membentuk matriks probabilitas 100 pasangan. Optimizer menguji seluruh subset digit yang mungkin dan memilih subset dengan expected coverage tertinggi.

## Runtime boundary

Aplikasi Next.js tidak membuka koneksi database Adaptive. UI memakai route Scan yang sudah ada dengan payload `action: "adaptive"`; persistence dan reconciliation dijalankan oleh service Deno terpisah pada `adaptive-service/main.mts`.

```text
Next.js POST /api/scan { action: "adaptive" }
        ↓ HTTPS + bearer secret
Deno Adaptive service
        ↓ Neon serverless HTTP driver
Neon PostgreSQL

Deno.cron setiap 15 menit
        ↓
Supabase markets.history_data
        ↓
replay / settlement market tertinggal
        ↓
Neon state + audit reconciliation
```

## Environment aplikasi Next.js

```env
ADAPTIVE_SERVICE_URL=https://YOUR-DENO-SERVICE.example
ADAPTIVE_SERVICE_SECRET=generate-a-long-random-secret
```

Tanpa `ADAPTIVE_SERVICE_URL`, Adaptive tetap menghasilkan preview, tetapi full replay dijalankan ulang setiap request dan state tidak disimpan.

## Environment service Deno

```env
NEON_DATABASE_URL=postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/DB?sslmode=require
ADAPTIVE_SERVICE_SECRET=same-secret-as-next-app
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=server-only-service-role-key
```

`SUPABASE_SERVICE_ROLE_KEY` hanya dipasang pada service Deno. Nilai ini tidak boleh dikirim ke browser atau dimasukkan ke environment publik.

Koneksi Neon direct hanya digunakan untuk migration atau administrasi:

```env
NEON_DIRECT_URL=postgresql://USER:PASSWORD@HOST.REGION.aws.neon.tech/DB?sslmode=require
```

## Migration

Jalankan migration secara berurutan pada Neon SQL Editor:

1. `sql/neon/001_adaptive_engine.sql`
2. `sql/neon/002_adaptive_online_learning.sql`
3. `sql/neon/003_adaptive_reconciliation.sql`

Migration kedua:

- menambah state histori dan revision;
- menambah tabel `adaptive.replay_runs`;
- membatalkan pending prediction foundation lama;
- membuat fungsi atomik `adaptive.store_online_run(jsonb)`;
- menyinkronkan snapshot histori;
- menyimpan state, prediction, selection, settlement, dan replay summary dalam satu transaksi.

Migration ketiga membuat `adaptive.reconciliation_runs` untuk audit cron dan retry manual.

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

Request dikirim ke `POST /api/scan`. Request Scan lama tanpa `action: "adaptive"` tetap diproses oleh engine Scan seperti sebelumnya.

Retry admin menggunakan route yang sama:

```json
{
  "action": "adaptive-reconcile",
  "marketLimit": 6
}
```

Aksi reconciliation manual memerlukan session admin.

## Endpoint service

```text
GET  /health
POST /context/load
POST /runs/store
POST /predictions/store       # kompatibilitas foundation
POST /reconcile               # retry manual/internal
POST /reconciliation/latest   # audit terbaru
```

Seluruh endpoint POST membutuhkan:

```text
Authorization: Bearer <ADAPTIVE_SERVICE_SECRET>
```

## Alur online learning

```text
Supabase markets.history_data
        ↓
load state + pending prediction dari Neon
        ↓
full replay jika state belum ada/tidak kompatibel
atau incremental replay dari processed_history_length
        ↓
predict setiap langkah sebelum membaca actual result
        ↓
Brier loss per expert
        ↓
multiplicative weight update + fixed-share
        ↓
settle pending prediction bila result berikutnya tersedia
        ↓
buat prediction selanjutnya
        ↓
adaptive.store_online_run(...)
```

State dipisahkan berdasarkan:

```text
market + target2D + engineVersion + configVersion
```

Tidak ada transfer bobot antar-market atau antar-target.

## Loss dan update bobot

Loss expert:

```text
70% pair Brier
15% left-position Brier
15% right-position Brier
```

Update:

```text
w' = w × exp(-1.0 × loss)
fixed-share = 2% ke prior family-balanced
normalisasi total bobot = 1
```

Fixed-share memberi kesempatan expert yang sebelumnya turun untuk pulih ketika pola market berubah.

## Replay mode

- `full`: state tidak ada, versi berbeda, histori dipangkas, atau histori tidak append-only.
- `incremental`: hanya result setelah `processed_history_length` yang diproses.
- `noop`: tidak ada result baru; state lama langsung digunakan.

Full replay dimulai setelah warmup 14 result. Histori sebelum warmup digunakan sebagai konteks awal, bukan sebagai langkah evaluasi.

## Expert V1

- Positional frequency
- Direct 2D frequency
- Decayed 2D frequency
- Pair transition dengan direct-frequency backoff
- Horizon 14, 28, 56, dan 112
- Prior family-balanced agar keluarga dengan banyak horizon tidak mendominasi

## Settlement

Prediction tersimpan dengan `history_length = N` menargetkan result pada index berikutnya. Ketika histori menjadi lebih panjang dari `N`:

- actual pair diambil dari result ke-`N + 1`;
- pair/left/right Brier dihitung;
- seluruh output AI atau BBFS yang diterbitkan pada prediction tersebut dievaluasi;
- expert loss direkonstruksi dari prefix histori yang sama;
- prediction ditandai `settled`;
- evaluation disimpan idempotent.

## Background reconciliation

Service Deno mendaftarkan cron `adaptive-market-reconciliation` setiap 15 menit dengan batch empat market.

Planner hanya menjadwalkan market/target yang:

- belum memiliki state;
- panjang histori berubah;
- result terakhir berubah; atau
- mempunyai pending prediction yang sudah mendapat actual result.

Market tanpa state diprioritaskan sebelum market incremental. Worker menggunakan output kanonik `BBFS 7` untuk memastikan setiap market dan target selalu memiliki pending prediction, sementara pilihan user lain ditambahkan ke prediction cutoff yang sama.

Semua write tetap idempotent melalui `adaptive.store_online_run(jsonb)`. Cron dan retry manual dapat berjalan berdekatan tanpa menggandakan settlement karena state target dilindungi PostgreSQL advisory transaction lock.

Setiap run mencatat:

- trigger cron/manual/API;
- jumlah market tersedia dan diproses;
- jumlah target full/incremental/noop;
- prediction yang di-settle;
- error dan sisa antrean;
- detail per market/target.

## Storage policy

Setiap prediction menyimpan:

- matriks final 100 nilai `real`;
- marginal kiri dan kanan;
- bobot expert yang digunakan;
- selection yang benar-benar diminta user;
- versi engine/config, state revision, dan cutoff histori.

Neon juga menyimpan:

- snapshot result minimal per market dan urutan;
- state aktif per market/target;
- ringkasan replay;
- evaluation settlement;
- audit reconciliation.

Intermediate matrix setiap expert tidak disimpan permanen. Expert loss direkonstruksi dari histori dan versi engine ketika settlement, sehingga storage tetap terkendali.

## Batas versi ini

Replay, online weighting, settlement, cron reconciliation, dan retry admin sudah aktif. Fase berikutnya berfokus pada:

1. drift warning/recovery;
2. calibration dan guardrail berdasarkan hasil shadow mode;
3. fingerprint koreksi histori internal;
4. dashboard evaluasi lift dan Brier per market/target.
