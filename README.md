# Analisa Angka

Analisa Angka adalah aplikasi web/PWA berbasis Next.js untuk membantu proses analisa angka per pasaran. Aplikasi ini berisi dashboard pasaran, menu analisa, rekap angka, statistik, riwayat evaluasi, dan rekomendasi Invest 2D.

Status akses saat ini: **mode PIN tertutup**. User wajib memasukkan PIN akses 8 digit sebelum membuka aplikasi. Admin mengelola PIN dan revoke device melalui `/admin`.

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

Flow aplikasi:

```txt
User buka web
→ middleware mengecek cookie akses
→ jika belum ada akses, user diarahkan ke /pin
→ user input PIN 8 digit
→ server validasi pin_hash di Supabase
→ session dibuat dan cookie httpOnly dipasang
→ user membuka dashboard, analisa, statistik, dan Invest
```

---

## 2. Sistem Akses PIN

Sistem akses memakai 3 tabel utama:

```txt
analisa_access_pins
analisa_access_sessions
analisa_rate_limits
```

Alur:

```txt
Admin login di /admin/login
Admin generate PIN di /admin
User input PIN di /pin
PIN berubah dari unused menjadi used
Session device dibuat di analisa_access_sessions
Percobaan PIN gagal dicatat di analisa_rate_limits
Admin bisa revoke akses device
```

Keamanan:

- PIN asli tidak disimpan di database; hanya `pin_hash`.
- Session token asli tidak disimpan di database; hanya `session_token_hash`.
- Cookie user memakai `analisa_access_token` dan `analisa_device_id`.
- Cookie admin memakai `analisa_admin_session`.
- Cookie diset `httpOnly`, `sameSite=lax`, dan `secure` saat production.
- API utama tetap memanggil `requireActiveAccess()` sehingga revoke admin langsung berlaku.
- Rate limit PIN memakai tabel `analisa_rate_limits` agar lock percobaan PIN tetap konsisten di serverless.

---

## 3. Fitur Utama

### 3.1 Dashboard / Beranda

- Menampilkan daftar pasaran.
- Menampilkan result terakhir.
- Mencari pasaran.
- Membuka halaman analisa per pasaran.
- Membuka menu Statistik.
- Membuka menu Invest.
- Request penambahan pasaran melalui WhatsApp admin.

### 3.2 Analisa Pasaran

Metode analisa:

- Angka Ikut / AI.
- BBFS.
- Angka Mati / OFF digit.
- Jumlah Mati.
- Shio Mati.
- Rekap / Racik Angka.
- Custom focus 2D / 3D / 4D.

### 3.3 Statistik dan Riwayat Evaluasi

- Statistik membaca tabel `market_statistics`.
- Riwayat Evaluasi membaca tabel `analysis_evaluations`.
- Data dipakai untuk membaca performa metode, ranking, hit/patah, dan stabilitas pasaran.

### 3.4 Invest 2D

Halaman Invest menampilkan rekomendasi kombinasi filter terbaik untuk:

- 2D Depan.
- 2D Tengah.
- 2D Belakang.

Rekomendasi diambil dari performa evaluasi terbaru, terutama riwayat 15 hasil terakhir.

### 3.5 Invest Angka Jadi

```txt
User klik Angka Jadi di card Invest
→ frontend memanggil /api/invest/angka-jadi
→ server menjalankan engine Rekap yang sama
→ server mengembalikan angka jadi
→ UI menampilkan angka langsung di card
```

---

## 4. API Routes

### 4.1 Akses

| Endpoint | Method | Fungsi |
|---|---:|---|
| `/pin` | GET | Halaman input PIN user. |
| `/api/pin/activate` | POST | Aktivasi PIN dan pembuatan session. |
| `/api/logout` | POST | Menghapus cookie akses user. |
| `/admin/login` | GET | Halaman login admin. |
| `/admin` | GET | Dashboard admin akses. |
| `/api/admin/login` | POST | Login admin. |
| `/api/admin/logout` | POST | Logout admin. |
| `/api/admin/pins` | GET/POST | List dan generate PIN. |
| `/api/admin/pins/[id]/revoke` | POST | Batalkan PIN unused. |
| `/api/admin/sessions` | GET | List session device. |
| `/api/admin/sessions/[id]/revoke` | POST | Revoke akses device. |

### 4.2 Data dan Analisa

Endpoint berikut diproteksi session aktif:

| Endpoint | Method | Fungsi |
|---|---:|---|
| `/api/markets` | GET | Mengambil daftar pasaran. |
| `/api/market-history` | GET | Mengambil histori pasaran. |
| `/api/analyze` | POST | Menjalankan engine analisa. |
| `/api/statistics` | GET | Mengambil statistik pasaran/metode. |
| `/api/evaluations` | GET | Mengambil riwayat evaluasi. |
| `/api/recommendations` | GET | Mengambil badge rekomendasi pada menu analisa. |
| `/api/invest` | GET | Mengambil rekomendasi Invest. |
| `/api/invest/angka-jadi` | POST | Menghasilkan Angka Jadi dari rekomendasi Invest. |

---

## 5. Environment Variables

Wajib:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ACCESS_SECRET=
ADMIN_PASSWORD=
```

Opsional:

```env
NEXT_PUBLIC_ADMIN_CONTACT_URL=
INTERNAL_API_SECRET=
```

Keterangan:

| Variable | Fungsi |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL Supabase untuk kebutuhan public/client-safe config. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key Supabase. |
| `SUPABASE_URL` | URL Supabase untuk helper server `createAdminClient()`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role untuk route server. Jangan expose ke client. |
| `ACCESS_SECRET` | Secret HMAC untuk hash PIN, session, IP, dan admin session. |
| `ADMIN_PASSWORD` | Password login `/admin/login`. |
| `NEXT_PUBLIC_ADMIN_CONTACT_URL` | URL WhatsApp/admin pada halaman PIN, misalnya `https://wa.me/628xxxxxxxxxx`. |
| `INTERNAL_API_SECRET` | Secret untuk request internal tepercaya ke `/api/analyze` tanpa session user. |

Jangan commit `.env` berisi credential asli.

---

## 6. Struktur Database Supabase

### 6.1 Tabel aplikasi

- `markets`
- `market_statistics`
- `analysis_evaluations`

### 6.2 Tabel akses

- `analisa_access_pins`
- `analisa_access_sessions`
- `analisa_rate_limits`

### 6.3 View admin

- `admin_analisa_access_pins_view`
- `admin_analisa_access_sessions_view`

SQL setup disimpan di luar repository dan dijalankan manual di Supabase.

---

## 7. Struktur Folder Penting

```txt
app/
  api/
    admin/
    analyze/
    evaluations/
    invest/
    market-history/
    markets/
    pin/
    recommendations/
    statistics/
  admin/
  pin/
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
    access.ts
    http.ts
    rateLimit.ts
    supabase-admin.ts

middleware.ts
```

---

## 8. Development Lokal

Install dependency:

```bash
pnpm install
```

Jalankan development server:

```bash
pnpm dev
```

Aplikasi berjalan di:

```txt
http://localhost:3000
```

Build production:

```bash
pnpm build
```

Typecheck:

```bash
pnpm typecheck
```

---

## 9. Deployment Vercel

Checklist deployment:

1. Jalankan SQL setup akses secara manual di Supabase.
2. Isi semua environment variables di Vercel.
3. Deploy branch.
4. Buka `/admin/login`.
5. Login memakai `ADMIN_PASSWORD`.
6. Generate PIN dari `/admin`.
7. Test user login melalui `/pin`.
8. Test revoke device dari `/admin`.

---

## 10. Catatan Keamanan

- Jangan expose `SUPABASE_SERVICE_ROLE_KEY` ke client.
- Jangan commit `.env`.
- Route yang memakai service role hanya boleh berada di server.
- Jangan membuka policy anon untuk tabel `analisa_access_pins`, `analisa_access_sessions`, dan `analisa_rate_limits`.
- Ganti `ACCESS_SECRET` dengan string panjang dan acak.
- Ganti `ADMIN_PASSWORD` jika ada dugaan bocor.

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
- Sistem akses PIN 8 digit.
- Admin panel generate/revoke akses.
- Device binding berbasis cookie + localStorage device id.

Fitur tidak dipakai:

- Login Telegram lama.
- JWT session lama.
- Role TRIAL / PRO lama.
