# Analisa Angka

Analisa Angka adalah aplikasi web berbasis Next.js untuk membantu proses analisa angka per pasaran. Aplikasi ini menggabungkan menu analisa, rekap angka, statistik, riwayat evaluasi, rekomendasi Invest 2D, dan sistem login Telegram dengan kontrol sesi berbasis device.

Dokumen ini menjelaskan status sistem terbaru, struktur fitur, flow login, API, database Supabase, cache Invest Angka Jadi, environment variables, serta panduan development dan deployment.

---

## 1. Ringkasan Sistem

Analisa Angka berjalan sebagai aplikasi web/PWA dengan stack utama:

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Supabase
- Telegram Bot Login
- JWT session
- Device binding
- Vercel deployment

Model akses saat ini tidak lagi memakai login VIP WhatsApp/password lama. Akses utama memakai kode login dari Telegram Bot.

Flow ringkas:

```txt
User buka Telegram Bot
→ bot membuat kode login 6 digit
→ user memasukkan kode di halaman /kode-login
→ server validasi kode + device
→ server menerbitkan JWT
→ aplikasi menyimpan session di browser
→ API protected membaca token + device id
```

---

## 2. Tech Stack

| Area | Teknologi |
|---|---|
| Framework | Next.js 16 |
| UI | React 19 |
| Bahasa | TypeScript |
| Styling | Tailwind CSS 4 |
| Database | Supabase PostgreSQL |
| Server client | Supabase Service Role |
| State data | TanStack React Query |
| Auth app | Telegram code login + JWT |
| Device control | Local device id + server hash |
| Icon | Lucide React |
| Deploy | Vercel |
| Runtime | Node.js >= 20.9 |

---

## 3. Fitur Utama

### 3.1 Dashboard / Beranda

Halaman utama menampilkan daftar pasaran dan navigasi utama.

Fungsi utama:

- melihat daftar pasaran,
- mencari pasaran,
- membuka halaman analisa per pasaran,
- membuka Statistik,
- membuka Invest,
- membuka panel akun.

Bottom navigation hanya tampil di Beranda (`/`) agar halaman lain lebih fokus dan tidak tertutup navigasi.

### 3.2 Menu Analisa Pasaran

Setiap pasaran memiliki halaman analisa dengan beberapa metode:

- Angka Ikut / AI
- BBFS
- Angka Mati
- Jumlah Mati
- Shio Mati
- Rekap / Racik Angka
- Custom focus 2D / 3D / 4D

Output analisa dipakai sebagai dasar penyaringan angka dan penyusunan kombinasi akhir.

### 3.3 Rekap / Angka Jadi

Rekap menggabungkan hasil beberapa metode menjadi angka siap pakai.

Prinsip penting:

```txt
Satu engine hitung dipakai bersama oleh Rekap dan Invest Angka Jadi.
```

Tujuannya agar hasil yang muncul di Invest konsisten dengan hasil yang muncul di Rekap.

### 3.4 Statistik Pasaran

Halaman Statistik membaca data dari `market_statistics`.

Fungsi utama:

- menampilkan performa metode,
- membandingkan parameter,
- membaca stabilitas pasaran,
- melihat ranking berdasarkan riwayat evaluasi.

Statistik memakai data evaluasi yang sudah diproses sebelumnya oleh evaluator/importer.

### 3.5 Riwayat Evaluasi

Riwayat Evaluasi membaca data dari `analysis_evaluations`.

Fungsi utama:

- melihat hasil evaluasi sebelumnya,
- memeriksa hit/patah metode,
- membandingkan parameter,
- membantu user tidak hanya bergantung pada hasil analisa terakhir.

### 3.6 Invest 2D

Halaman Invest menampilkan rekomendasi kombinasi filter terbaik untuk:

- 2D Depan,
- 2D Tengah,
- 2D Belakang.

Rekomendasi diambil dari performa pada hasil evaluasi terbaru, terutama riwayat 15 hasil terakhir.

Halaman Invest terdiri dari:

- Rekomendasi Sempurna,
- Semua Pasaran,
- grup 2D Depan / Tengah / Belakang,
- card rekomendasi per pasaran,
- tombol Angka Jadi yang bisa dibuka-tutup.

### 3.7 Invest Angka Jadi

Fitur terbaru pada halaman Invest.

Alur:

```txt
User klik Angka Jadi di card Invest
→ frontend memanggil /api/invest/angka-jadi
→ server menjalankan engine Rekap yang sama
→ server mengembalikan angka jadi
→ UI menampilkan angka langsung di card
→ user bisa copy angka jadi
```

Catatan penting:

- Invest tidak membuka halaman Rekap di background.
- Invest memakai engine Rekap yang sama di server.
- Hasil bisa dibaca dari cache jika kombinasi yang sama sudah pernah dihitung.
- Panel Angka Jadi bisa dibuka dan ditutup.
- Jika sudah pernah dihitung di client, buka ulang tidak menghitung ulang dari client state.

---

## 4. Role dan Akses

Role JWT yang didukung:

```txt
TRIAL
PRO
```

Pada data Telegram user, plan utama yang aktif adalah:

```txt
NONE
TRIAL
PRO
```

Ringkasan:

| Plan | Fungsi |
|---|---|
| NONE | Belum punya akses aktif. Bisa minta kode jika trial belum pernah dipakai. |
| TRIAL | Akses percobaan dengan masa berlaku tertentu. |
| PRO | Akses aktif berbayar. |

Saat ini trial pada endpoint code login dikonfigurasi melalui konstanta:

```ts
const TRIAL_DAYS = 7;
```

File:

```txt
app/api/code-login/route.ts
```

Jika ingin trial 14 hari, ubah konstanta tersebut menjadi:

```ts
const TRIAL_DAYS = 14;
```

---

## 5. Sistem Login Telegram

### 5.1 Telegram Bot

User meminta kode login melalui Telegram Bot.

Bot menerima pesan dari user, membuat kode 6 digit, lalu menyimpan hash kode ke database.

Endpoint webhook:

```txt
/api/telegram/webhook
```

Bot mengirim kode login ke user melalui Telegram.

### 5.2 Halaman Login

Halaman login aplikasi:

```txt
/kode-login
```

User memasukkan kode 6 digit dari bot.

Frontend mengirim:

```json
{
  "code": "123456",
  "device_id": "local-device-id"
}
```

Server memvalidasi:

- hash kode,
- masa berlaku kode,
- status kode sudah dipakai atau belum,
- plan user,
- status trial/pro,
- device binding,
- active session.

### 5.3 Token JWT

Setelah login berhasil, server membuat JWT.

Payload inti:

```json
{
  "role": "TRIAL",
  "accountId": "telegram-user-row-id",
  "sessionId": "active-session-id",
  "tokenVersion": 2
}
```

Token disimpan di browser dengan key:

```txt
aa_token
```

Storage pendukung:

```txt
aa_role
aa_expires_at
aa_telegram_user_id
aa_device_id
```

---

## 6. Device Binding dan Anti Sharing

Aplikasi menerapkan kontrol satu akun aktif berbasis session dan device.

### 6.1 Device ID

Client membuat device id lokal dan menyimpannya di:

```txt
aa_device_id
```

Device id dikirim ke server melalui header:

```txt
x-aa-device-id
```

Server tidak menyimpan device id mentah. Server menyimpan hash device id.

### 6.2 Active Session

Saat login sukses:

```txt
telegram_users.active_session_id = session baru
telegram_users.active_device_hash = hash device
telegram_users.active_device_at = waktu login
```

Jika user login dari device lain, session lama menjadi tidak valid.

### 6.3 Proteksi API

API protected memanggil verifier:

```txt
verifyActiveTelegramSession()
```

Verifier mengecek:

- Authorization Bearer token,
- token valid,
- tokenVersion valid,
- active_session_id cocok,
- device hash cocok,
- user aktif,
- plan belum expired.

Jika token dicopy ke device lain, request ditolak karena device id tidak cocok.

---

## 7. API Routes

### 7.1 Auth dan Telegram

| Endpoint | Method | Fungsi |
|---|---:|---|
| `/api/telegram/webhook` | POST | Menerima update dari Telegram Bot dan membuat kode login. |
| `/api/code-login` | POST | Menukar kode Telegram menjadi JWT aplikasi. |
| `/api/verify-session` | GET/POST | Memeriksa validitas token dan device session. |

### 7.2 Data dan Analisa

| Endpoint | Method | Fungsi |
|---|---:|---|
| `/api/markets` | GET | Mengambil daftar pasaran. |
| `/api/analyze` | POST | Menjalankan engine analisa. |
| `/api/statistics` | GET | Mengambil statistik pasaran/metode. |
| `/api/evaluations` | GET | Mengambil riwayat evaluasi. |

### 7.3 Invest

| Endpoint | Method | Fungsi |
|---|---:|---|
| `/api/invest` | GET | Mengambil overview rekomendasi Invest. |
| `/api/invest?marketId=...` | GET | Mengambil rekomendasi Invest untuk satu pasaran. |
| `/api/invest/angka-jadi` | POST | Menghasilkan Angka Jadi dari rekomendasi Invest. |

---

## 8. Invest Angka Jadi dan Cache

### 8.1 Tujuan Cache

Cache dipakai agar kombinasi Invest yang sama tidak dihitung berulang untuk semua user.

Contoh:

```txt
User A klik Angka Jadi untuk PASARAN X 2D BELAKANG filter tertentu
→ server hitung dan simpan cache

User B klik rekomendasi yang sama
→ server langsung ambil cache
```

### 8.2 Cache Key

Cache key dibentuk dari:

```txt
marketId + pair + filters + latestResult + formulaVersion
```

Jika hasil terbaru berubah, `latestResult` berubah, sehingga cache lama otomatis tidak dipakai.

### 8.3 TTL Cache

Konfigurasi saat ini di:

```txt
app/api/invest/angka-jadi/route.ts
```

Nilai utama:

```ts
const CACHE_TTL_HOURS = 12;
const CACHE_CLEANUP_GRACE_HOURS = 24;
```

Artinya:

- cache valid selama 12 jam,
- cache lama yang sudah expired lebih dari 24 jam bisa dibersihkan otomatis oleh endpoint.

### 8.4 Tabel Cache

Tabel cache bersifat opsional. Jika tabel belum dibuat, fitur Angka Jadi tetap berjalan, tetapi tanpa cache.

SQL:

```sql
create table if not exists public.invest_angka_jadi_cache (
  id uuid primary key default gen_random_uuid(),

  cache_key text not null unique,
  market_id text not null,
  pair text not null,
  filters_json jsonb not null,

  latest_result text,
  formula_version text not null,

  angka_jadi jsonb not null,
  line_count int,

  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists idx_invest_angka_jadi_cache_expires
on public.invest_angka_jadi_cache (expires_at);

create index if not exists idx_invest_angka_jadi_cache_market_pair
on public.invest_angka_jadi_cache (market_id, pair);
```

---

## 9. Environment Variables

### 9.1 Wajib

```env
SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
JWT_SECRET=
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
```

### 9.2 Opsional

```env
TELEGRAM_LOGIN_CODE_SECRET=
TOKEN_VERSION=2
INTERNAL_API_SECRET=
```

### 9.3 Keterangan

| Variable | Fungsi |
|---|---|
| `SUPABASE_URL` | Dipakai server helper `createAdminClient()`. |
| `NEXT_PUBLIC_SUPABASE_URL` | Dipakai route Telegram webhook dan client/public config bila dibutuhkan. |
| `SUPABASE_SERVICE_ROLE_KEY` | Dipakai server untuk akses database Supabase tanpa RLS. Jangan expose ke client. |
| `JWT_SECRET` | Secret untuk sign dan verify JWT aplikasi. |
| `TELEGRAM_BOT_TOKEN` | Token bot Telegram. |
| `TELEGRAM_WEBHOOK_SECRET` | Secret token untuk validasi webhook Telegram. |
| `TELEGRAM_LOGIN_CODE_SECRET` | Secret khusus hashing kode login. Jika kosong, fallback ke `TELEGRAM_WEBHOOK_SECRET`. |
| `TOKEN_VERSION` | Versi token JWT. Default `2`. Naikkan untuk invalidasi semua token lama. |
| `INTERNAL_API_SECRET` | Secret internal jika ada route yang membutuhkan bypass tertentu. |

Jangan commit `.env` yang berisi credential asli.

---

## 10. Struktur Database Supabase

Bagian ini berisi tabel inti yang dipakai aplikasi. Struktur detail bisa disesuaikan dengan migrasi yang sudah ada, tetapi kolom-kolom berikut adalah yang penting untuk sistem berjalan.

### 10.1 `telegram_users`

Menyimpan akun Telegram, status trial/pro, session aktif, dan device aktif.

Kolom penting:

```sql
create table if not exists public.telegram_users (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null unique,
  chat_id bigint,
  telegram_username text,
  telegram_first_name text,
  telegram_last_name text,
  telegram_language_code text,

  plan text not null default 'NONE',
  trial_used boolean not null default false,
  trial_started_at timestamptz,
  trial_expires_at timestamptz,
  pro_started_at timestamptz,
  pro_expires_at timestamptz,

  is_active boolean not null default true,
  suspended_at timestamptz,

  active_session_id text,
  active_session_at timestamptz,
  active_device_hash text,
  active_device_at timestamptz,
  active_device_user_agent_hash text,

  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Tambahan jika tabel sudah ada:

```sql
alter table public.telegram_users
add column if not exists active_session_id text,
add column if not exists active_session_at timestamptz,
add column if not exists active_device_hash text,
add column if not exists active_device_at timestamptz,
add column if not exists active_device_user_agent_hash text;
```

### 10.2 `telegram_login_codes`

Menyimpan kode login dari Telegram dalam bentuk hash.

```sql
create table if not exists public.telegram_login_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  telegram_user_id bigint not null,
  chat_id bigint,
  code_hash text not null,
  code_type text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  consumed_session_id text,
  created_at timestamptz not null default now()
);

create index if not exists telegram_login_codes_hash_idx
on public.telegram_login_codes (code_hash);

create index if not exists telegram_login_codes_user_idx
on public.telegram_login_codes (user_id, created_at desc);
```

### 10.3 `telegram_access_events`

Menyimpan event login, gagal login, dan aktivitas akses penting.

```sql
create table if not exists public.telegram_access_events (
  id bigserial primary key,
  user_id uuid,
  telegram_user_id bigint,
  chat_id bigint,
  event_type text not null,
  event_detail text,
  metadata jsonb not null default '{}',
  ip_hash text,
  user_agent_hash text,
  created_at timestamptz not null default now()
);

create index if not exists telegram_access_events_user_idx
on public.telegram_access_events (user_id, created_at desc);

create index if not exists telegram_access_events_telegram_idx
on public.telegram_access_events (telegram_user_id, created_at desc);
```

### 10.4 `markets`

Menyimpan daftar pasaran dan data histori.

Kolom yang umum dipakai oleh sistem:

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

### 10.5 `market_statistics`

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

### 10.6 `analysis_evaluations`

Dipakai untuk riwayat evaluasi.

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

## 11. Struktur Folder Penting

```txt
app/
  api/
    analyze/
    code-login/
    evaluations/
    invest/
    markets/
    statistics/
    telegram/webhook/
    verify-session/
  kode-login/
  rekomendasi/
  pantauan-rekap/
  analyze/[market]/

components/
  account/
  analysis/
  auth/
  install/
  layout/
  ui/

lib/
  access/
  analysis/
  auth/
  markets/
  server/
```

Folder inti:

| Folder | Fungsi |
|---|---|
| `app/api` | Route handler server. |
| `components/analysis` | UI dan client controller fitur analisa. |
| `lib/analysis` | Helper/engine analisa yang bisa dipakai ulang. |
| `lib/server` | Helper server-only: Supabase admin, JWT, session verifier, engines. |
| `components/auth` | Auth context dan AuthGate. |
| `components/layout` | Shell aplikasi dan navigasi. |

---

## 12. Development Lokal

### 12.1 Install dependency

```bash
pnpm install
```

### 12.2 Jalankan development server

```bash
pnpm dev
```

Aplikasi berjalan di:

```txt
http://localhost:3000
```

### 12.3 Build production

```bash
pnpm build
```

### 12.4 Typecheck

```bash
pnpm typecheck
```

### 12.5 Format

```bash
pnpm format
```

---

## 13. Deployment Vercel

Checklist deployment:

1. Pastikan semua environment variables sudah diisi di Vercel.
2. Pastikan tabel Supabase sudah tersedia.
3. Pastikan Telegram webhook sudah diarahkan ke domain production.
4. Jalankan build.
5. Test login dari Telegram.
6. Test halaman utama, analisa, statistik, Invest, dan Angka Jadi Invest.

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

## 14. Setup Telegram Webhook

Contoh setup webhook:

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.analisa-angka.site/api/telegram/webhook",
    "secret_token": "<TELEGRAM_WEBHOOK_SECRET>"
  }'
```

Cek webhook:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

---

## 15. Catatan Keamanan

- Jangan expose `SUPABASE_SERVICE_ROLE_KEY` ke client.
- Jangan commit `.env`.
- Jangan simpan kode login dalam bentuk plain text.
- Kode login harus disimpan dalam bentuk hash.
- Device id mentah tidak disimpan di database.
- JWT harus selalu diverifikasi di server.
- Route protected harus memakai `verifyActiveTelegramSession()`.
- Jika token bocor, naikkan `TOKEN_VERSION` untuk invalidasi token lama.

---

## 16. Catatan Produk

Analisa Angka adalah alat bantu analisa berbasis data historis dan evaluasi sistem. Hasil analisa bukan jaminan hasil akhir. User tetap perlu memahami risiko dan memakai fitur sebagai alat bantu penyaringan, bukan kepastian.

---

## 17. Status Fitur Terbaru

Fitur terbaru yang sudah masuk:

- Login Telegram berbasis kode.
- Device binding untuk mengurangi sharing akun.
- Panel akun di aplikasi.
- Bottom navigation hanya di Beranda.
- Invest 2D dengan grouping Depan / Tengah / Belakang.
- Invest Angka Jadi langsung di halaman Invest.
- Copy Angka Jadi dari card Invest.
- Cache Invest Angka Jadi di Supabase.
- Auto cleanup cache expired melalui endpoint Angka Jadi.

---

## 18. Ringkasan Alur Invest Angka Jadi

```txt
User buka Invest
→ pilih 2D Depan / Tengah / Belakang
→ klik Angka Jadi pada card pasaran
→ API cek cache
→ jika cache valid, langsung return
→ jika cache miss, hitung dengan engine Rekap
→ simpan cache 12 jam
→ tampilkan angka jadi
→ user copy angka
```

Prinsip utama:

```txt
Rekap dan Invest memakai engine hitung yang sama.
```
