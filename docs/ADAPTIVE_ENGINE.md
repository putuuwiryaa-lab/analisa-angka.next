# HF-APIE Adaptive Engine

Status: foundation implementation.

Adaptive berada di halaman Scan sebagai tab ketiga, tetapi tidak memakai formula atau state milik Scan/Batch.

## Kontrak produk

- Metode: `ai` atau `bbfs`
- Jumlah digit: `1` sampai `9`
- Target: `depan` (A-C), `tengah` (C-K), atau `belakang` (K-E)
- AI berhasil jika minimal satu digit target masuk output.
- BBFS berhasil jika kedua digit target masuk output.

Engine membentuk matriks probabilitas 100 pasangan. Optimizer menguji seluruh subset digit yang mungkin dan memilih subset dengan expected coverage tertinggi.

## Runtime boundary

Aplikasi Next.js tidak membuka koneksi database Adaptive. Persistence dijalankan oleh service Deno terpisah pada `adaptive-service/main.mts`.

```text
Next.js /api/adaptive
        ↓ HTTPS + bearer secret
Deno Adaptive service
        ↓ Neon serverless HTTP driver
Neon PostgreSQL
```

Pemisahan ini menjaga driver dan kredensial Neon keluar dari bundle aplikasi serta menyediakan tempat khusus untuk replay, settlement, reconciliation, dan drift worker berikutnya.

## Environment aplikasi Next.js

```env
ADAPTIVE_SERVICE_URL=https://YOUR-DENO-SERVICE.example
ADAPTIVE_SERVICE_SECRET=generate-a-long-random-secret
```

Tanpa `ADAPTIVE_SERVICE_URL`, API Adaptive tetap menghasilkan preview tetapi tidak menyimpan prediction.

## Environment service Deno

```env
NEON_DATABASE_URL=postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/DB?sslmode=require
ADAPTIVE_SERVICE_SECRET=same-secret-as-next-app
```

Koneksi direct hanya digunakan untuk migration atau administrasi replay:

```env
NEON_DIRECT_URL=postgresql://USER:PASSWORD@HOST.REGION.aws.neon.tech/DB?sslmode=require
```

## Migration

1. Buat project/database Neon.
2. Buka Neon SQL Editor.
3. Jalankan seluruh isi `sql/neon/001_adaptive_engine.sql`.
4. Deploy `adaptive-service/main.mts` pada runtime Deno dengan `NEON_DATABASE_URL` dan `ADAPTIVE_SERVICE_SECRET`.
5. Tambahkan URL service dan secret yang sama ke environment Next.js/Vercel.
6. Deploy ulang aplikasi.

Migration membuat schema terisolasi `adaptive` dan tidak menyentuh tabel Supabase atau tabel aplikasi lain.

## Endpoint service

```text
GET  /health
POST /predictions/store
```

`POST /predictions/store` hanya menerima request dengan header:

```text
Authorization: Bearer <ADAPTIVE_SERVICE_SECRET>
```

## Data flow foundation

```text
Supabase markets.history_data
        ↓
/api/adaptive
        ↓
family-balanced baseline experts
        ↓
100 pair probabilities
        ↓
AI/BBFS exhaustive subset optimizer
        ↓
Deno /predictions/store
        ↓
adaptive.store_prediction(...)
        ↓
Neon adaptive.predictions + adaptive.published_selections
```

## Expert foundation

- Positional frequency
- Direct 2D frequency
- Decayed 2D frequency
- Pair transition dengan direct-frequency backoff
- Horizon 14, 28, 56, dan 112
- Equal family weight untuk mencegah keluarga dengan banyak horizon mendominasi

Foundation belum mengubah bobot berdasarkan settlement. Versi berikutnya menambahkan:

1. replay `predict → settle → update`;
2. pair/positional Brier loss;
3. hierarchical online weights;
4. fixed-share dan guardrail;
5. automatic result reconciliation;
6. drift warning/recovery.

## Storage policy

Setiap prediction menyimpan:

- matriks final 100 nilai `real`;
- marginal kiri dan kanan;
- bobot expert yang digunakan;
- selection yang benar-benar diminta user;
- versi engine/config dan cutoff histori.

Intermediate matrix dan debug payload setiap expert tidak disimpan permanen pada tahap normal agar Neon tidak cepat penuh.
