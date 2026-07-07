# Analisa Angka

Analisa Angka adalah aplikasi web/PWA berbasis Next.js untuk membantu proses analisa angka per pasaran. Aplikasi ini berisi dashboard pasaran, menu analisa, rekap angka, statistik, riwayat evaluasi, dan rekomendasi Invest 2D.

Status akses saat ini: **mode public sementara**. Sistem login, Telegram code login, JWT session, dan device binding tidak dipakai dulu sampai tahap aktivasi berikutnya.

---

## 1. Ringkasan Sistem

Stack utama:

| Area | Teknologi |
|---|---|
| Framework | Next.js App Router |
| UI | React |
| Bahasa | TypeScript |
| Styling | Tailwind CSS |
| Data | Supabase PostgreSQL |
| State data | TanStack React Query |
| Deploy | Vercel |
| Runtime | Node.js >= 20.9 |

Flow aplikasi saat ini:

```txt
User buka web
→ aplikasi mengambil daftar pasaran dari Supabase
→ user memilih pasaran
→ user menjalankan analisa / statistik / invest
→ server menjalankan engine dan mengembalikan hasil
```

---

## 2. Fitur Utama

### 2.1 Dashboard / Beranda

Fungsi utama:

- menampilkan daftar pasaran,
- menampilkan result terakhir,
- mencari pasaran,
- membuka halaman analisa per pasaran,
- membuka menu Statistik,
- membuka menu Invest,
- request penambahan pasaran melalui WhatsApp admin.

Bottom navigation hanya tampil di Beranda agar halaman analisa lebih fokus.

### 2.2 Analisa Pasaran

Setiap pasaran memiliki beberapa metode analisa:

- Angka Ikut / AI,
- BBFS,
- Angka Mati / OFF digit,
- Jumlah Mati,
- Shio Mati,
- Rekap / Racik Angka,
- Custom focus 2D / 3D / 4D.

Output analisa dipakai sebagai dasar penyaringan angka dan penyusunan kombinasi akhir.

### 2.3 Rekap / Angka Jadi

Rekap menggabungkan hasil beberapa metode menjadi angka siap pakai.

Prinsip utama:

```txt
Satu engine hitung dipakai bersama oleh Rekap dan Invest Angka Jadi.
```

Tujuannya agar hasil yang muncul di Invest konsisten dengan hasil yang muncul di Rekap.

### 2.4 Statistik Pasaran

Halaman Statistik membaca data dari tabel `market_statistics`.

Fungsi utama:

- menampilkan performa metode,
- membandingkan parameter,
- membaca stabilitas pasaran,
- melihat ranking berdasarkan riwayat evaluasi.

Statistik memakai data evaluasi yang sudah diproses sebelumnya oleh evaluator/importer.

### 2.5 Riwayat Evaluasi

Riwayat Evaluasi membaca data dari tabel `analysis_evaluations`.

Fungsi utama:

- melihat hasil evaluasi sebelumnya,
- memeriksa hit/patah metode,
- membandingkan parameter,
- membantu user tidak hanya bergantung pada hasil analisa terakhir.

### 2.6 Invest 2D

Halaman Invest menampilkan rekomendasi kombinasi filter terbaik untuk:

- 2D Depan,
- 2D Tengah,
- 2D Belakang.

Rekomendasi diambil dari performa hasil evaluasi terbaru, terutama riwayat 15 hasil terakhir.

Halaman Invest terdiri dari:

- Rekomendasi Sempurna,
- Semua Pasaran,
- grup 2D Depan / Tengah / Belakang,
- card rekomendasi per pasaran,
- tombol Angka Jadi yang bisa dibuka-tutup.

### 2.7 Invest Angka Jadi

Alur:

```txt
User klik Angka Jadi di card Invest
→ frontend memanggil /api/invest/angka-jadi
→ server menjalankan engine Rekap yang sama
→ server mengembalikan angka jadi
→ UI menampilkan angka langsung di card
→ user bisa copy angka jadi
```

Catatan:

- Invest tidak membuka halaman Rekap di background.
- Invest memakai engine Rekap yang sama di server.
- Panel Angka Jadi bisa dibuka dan ditutup.
- Jika cache ingin diaktifkan lagi, implementasi cache perlu disinkronkan ulang dengan route `app/api/invest/angka-jadi/route.ts`.

---

## 3. Status Akses Sementara

Aplikasi berjalan dalam **mode public sementara**.

Yang sedang tidak aktif:

- login Telegram,
- kode login 6 digit,
- JWT session,
- device binding,
- role TRIAL / PRO,
- halaman akun,
- proteksi akses berbasis device.

Route login lama diarahkan kembali ke halaman utama melalui konfigurasi Next.js. Saat sistem akses ingin diaktifkan kembali, auth guard perlu dipasang ulang pada API yang dianggap premium.

---

## 4. API Routes

### 4.1 Data dan Analisa

| Endpoint | Method | Fungsi |
|---|---:|---|
| `/api/markets` | GET | Mengambil daftar pasaran. |
| `/api/analyze` | POST | Menjalankan engine analisa. |
| `/api/statistics` | GET | Mengambil statistik pasaran/metode. |
| `/api/evaluations` | GET | Mengambil riwayat evaluasi. |
| `/api/recommendations` | GET | Mengambil badge rekomendasi pada menu analisa. |

### 4.2 Invest

| Endpoint | Method | Fungsi |
|---|---:|---|
| `/api/invest` | GET | Mengambil overview rekomendasi Invest. |
| `/api/invest?marketId=...` | GET | Mengambil rekomendasi Invest untuk satu pasaran. |
| `/api/invest/angka-jadi` | POST | Menghasilkan Angka Jadi dari rekomendasi Invest. |

---

## 5. Environment Variables

### 5.1 Wajib

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

### 5.2 Keterangan

| Variable | Fungsi |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL Supabase untuk kebutuhan public/client-safe config. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key untuk endpoint public seperti daftar pasaran. |
| `SUPABASE_URL` | URL Supabase untuk server helper `createAdminClient()`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role untuk route server. Jangan expose ke client. |

Jangan commit `.env` yang berisi credential asli.

---

## 6. Struktur Database Supabase

Bagian ini berisi tabel inti yang dipakai aplikasi. Struktur detail bisa disesuaikan dengan migrasi yang sudah ada.

### 6.1 `markets`

Menyimpan daftar pasaran dan data histori.

Kolom yang umum dipakai:

```txt
id
name
history_data / historyData / history / data / results / result
updated_at
```

Data histori dibaca sebagai token 4 digit, contoh:

```txt
1234 5678 9012 3456
```

### 6.2 `market_statistics`

Dipakai untuk Statistik dan Invest.

Kolom penting:

```txt
market_id
market_name
group_key
mode
position
param
target_pair
analysis_scope
is_active
wins_15
wins_last_5
max_loss_streak
score
updated_at
```

Invest hanya mengambil kombinasi yang memenuhi standar statistik aktif, antara lain:

- `is_active = true`,
- `wins_15` memenuhi batas minimum,
- `wins_last_5` memenuhi batas minimum,
- `max_loss_streak` tidak melewati batas.

### 6.3 `analysis_evaluations`

Dipakai untuk Riwayat Evaluasi.

Kolom umum:

```txt
id
market_id
mode
param
position
target_pair
analysis_scope
from_result
new_result
is_hit
status
detail
evaluated_at
```

---

## 7. Struktur Folder Penting

```txt
app/
  api/
    analyze/
    evaluations/
    invest/
    markets/
    recommendations/
    statistics/
  rekomendasi/
  pantauan-rekap/
  analyze/[market]/

components/
  analysis/
  history/
  install/
  layout/
  ui/

lib/
  analysis/
  markets/
  server/
```

Folder inti:

| Folder | Fungsi |
|---|---|
| `app/api` | Route handler server. |
| `components/analysis` | UI dan client controller fitur analisa. |
| `components/history` | UI riwayat evaluasi. |
| `lib/analysis` | Helper analisa yang bisa dipakai ulang. |
| `lib/server` | Helper server-only: Supabase admin dan engine. |
| `components/layout` | Shell aplikasi dan navigasi. |

---

## 8. Development Lokal

### 8.1 Install dependency

```bash
pnpm install
```

### 8.2 Jalankan development server

```bash
pnpm dev
```

Aplikasi berjalan di:

```txt
http://localhost:3000
```

### 8.3 Build production

```bash
pnpm build
```

### 8.4 Typecheck

```bash
pnpm typecheck
```

### 8.5 Format

```bash
pnpm format
```

---

## 9. Deployment Vercel

Checklist deployment:

1. Pastikan environment variables Supabase sudah diisi di Vercel.
2. Pastikan tabel Supabase sudah tersedia.
3. Jalankan build.
4. Test halaman utama, analisa, statistik, Invest, dan Angka Jadi Invest.

Command build:

```bash
pnpm build
```

Jika deploy di Vercel gagal, cek log pada bagian:

- TypeScript error,
- missing environment variable,
- import path salah,
- route server memakai package client-only,
- tabel Supabase belum ada.

---

## 10. Catatan Keamanan

- Jangan expose `SUPABASE_SERVICE_ROLE_KEY` ke client.
- Jangan commit `.env`.
- Route yang memakai service role hanya boleh berada di server.
- Jika mode login/PRO diaktifkan kembali, pasang auth guard pada API premium.
- Endpoint public hanya boleh mengembalikan data yang memang aman untuk dibuka.

---

## 11. Catatan Produk

Analisa Angka adalah alat bantu analisa berbasis data historis dan evaluasi sistem. Hasil analisa bukan jaminan hasil akhir. User tetap perlu memahami risiko dan memakai fitur sebagai alat bantu penyaringan, bukan kepastian.

---

## 12. Status Fitur Saat Ini

Fitur aktif:

- Dashboard pasaran.
- Search pasaran.
- Analisa per pasaran.
- Rekap / racik angka.
- Statistik pasaran.
- Riwayat evaluasi.
- Invest 2D dengan grouping Depan / Tengah / Belakang.
- Invest Angka Jadi langsung di halaman Invest.
- Copy Angka Jadi dari card Invest.
- Mode public sementara tanpa login.

Fitur ditunda:

- Login Telegram.
- Trial / PRO.
- Device binding.
- Panel akun.
- Cache Invest Angka Jadi berbasis tabel Supabase.
