# Analisa Angka

Analisa Angka adalah aplikasi web berbasis Next.js untuk membantu proses analisa angka per pasaran. Aplikasi ini menyediakan beberapa metode analisa, sistem akses Free/VIP, riwayat evaluasi, statistik pasaran, dan rekap angka.

Dokumen ini menjelaskan arsitektur, fitur, aturan akses, konfigurasi environment, struktur data Supabase, alur login VIP, sistem anti-sharing akun, serta panduan development dan deployment.

---

## 1. Ringkasan Sistem

Aplikasi menggunakan pendekatan freemium.

Pengguna Free tetap dapat memakai fitur dasar untuk mencoba value utama aplikasi. Fitur yang lebih berat atau lebih bernilai dikunci untuk VIP agar beban server tetap terkendali dan fitur premium tetap punya nilai yang jelas.

Akses VIP berbasis akun Supabase Auth, bukan device lokal. User login dengan nomor WhatsApp dan password yang dibuat oleh admin. Setelah login, server menerbitkan JWT yang berisi role, accountId, phone, dan sessionId.

Sistem juga menerapkan satu akun satu sesi aktif. Jika akun yang sama login di browser atau device lain, sesi lama otomatis tidak valid. Jika pergantian sesi terlalu sering dalam 24 jam, akun VIP dapat dikunci sementara selama 24 jam.

---

## 2. Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase
- Supabase Auth
- Supabase Service Role untuk server route
- TanStack React Query
- JWT untuk token VIP aplikasi
- Vercel untuk deployment

---

## 3. Fitur Utama

### 3.1 Dashboard Pasaran

Halaman utama menampilkan daftar pasaran yang tersedia. User dapat:

- melihat update terakhir pasaran,
- mencari pasaran,
- membuka halaman analisa per pasaran,
- request penambahan pasaran lewat WhatsApp admin.

### 3.2 Menu Analisa

Setiap pasaran memiliki menu analisa. Menu dapat dibuka atau dikunci tergantung role user.

Mode utama:

- Angka Ikut
- BBFS
- Angka Mati
- Jumlah Mati
- Shio Mati
- Rekap / Racik Angka

### 3.3 Angka Ikut

Mode Angka Ikut membantu membaca digit yang berpotensi ikut pada posisi tertentu.

Cakupan posisi:

- 2D Depan
- 2D Tengah
- 2D Belakang
- 3D
- 4D

Untuk Free, hanya 2D Belakang yang dibuka.

### 3.4 Angka Mati

Mode Angka Mati membantu membaca digit yang sebaiknya dihindari pada posisi tertentu.

Untuk Free, Angka Mati dibuka semua parameter.

### 3.5 BBFS

BBFS membantu menyaring digit utama yang relevan untuk pasaran tertentu. Mode ini cocok dipakai sebagai dasar penyaringan sebelum menyusun kombinasi angka.

Untuk Free, BBFS dikunci.

### 3.6 Jumlah Mati

Jumlah Mati membantu membaca nilai jumlah yang sebaiknya dihindari pada posisi tertentu. Fitur ini berguna untuk mempersempit pilihan angka.

Untuk Free, Jumlah Mati dikunci.

### 3.7 Shio Mati

Shio Mati membantu membaca shio yang sebaiknya dihindari sebagai filter tambahan sebelum menentukan kombinasi angka akhir.

Untuk Free, Shio Mati dikunci.

### 3.8 Statistik VIP

Statistik menampilkan ranking statistik dari berbagai metode, parameter, dan pasaran. Fitur ini membantu user membandingkan performa antar metode untuk melihat mana yang sedang lebih stabil dan layak dijadikan fokus analisa.

Manfaat utama:

- melihat ranking pasaran,
- membandingkan metode,
- membandingkan parameter,
- menyusun rencana analisa atau betting dengan lebih terarah,
- tidak hanya mengandalkan satu hasil analisa terakhir.

Statistik hanya untuk VIP.

### 3.9 Riwayat Evaluasi VIP

Riwayat Evaluasi menampilkan hasil evaluasi analisa hingga 2 minggu terakhir. Dari data ini user dapat melihat apakah metode dan parameter tertentu masih stabil, mulai menurun, atau kurang cocok untuk pasaran tertentu.

Manfaat utama:

- melihat performa historis,
- membandingkan hasil sebelumnya,
- menilai kestabilan metode,
- menghindari pemilihan metode hanya berdasarkan hasil terakhir.

Riwayat Evaluasi hanya untuk VIP.

### 3.10 Rekap Angka VIP

Rekap membantu menggabungkan hasil dari beberapa metode analisa menjadi kombinasi angka yang lebih siap digunakan. Sistem juga dapat menampilkan badge khusus untuk membantu membaca kombinasi yang relevan pada pasaran tertentu.

Manfaat utama:

- mempercepat proses penyaringan angka,
- menggabungkan beberapa sumber analisa,
- membantu menentukan kombinasi prioritas,
- membaca pola gabungan dengan lebih mudah.

Rekap hanya untuk VIP.

---

## 4. Aturan Akses Free dan VIP

Role yang digunakan:

- FREE
- PRO
- MASTER

TRIAL masih ada di type, tetapi akses VIP utama saat ini difokuskan ke PRO dan MASTER.

### 4.1 Akses Free

Free dapat memakai:

- Angka Ikut 2D Belakang: semua parameter Free yang tersedia.
- Angka Mati: semua parameter.

Free tidak dapat memakai:

- BBFS
- Jumlah Mati
- Shio Mati
- Statistik
- Riwayat Evaluasi
- Rekap / Racik Angka

### 4.2 Akses PRO

PRO dapat memakai fitur VIP penuh selama masa aktif belum habis dan akun tidak disuspend.

Token PRO berlaku 60 hari.

### 4.3 Akses MASTER

MASTER dapat memakai fitur VIP penuh dengan durasi token lebih panjang.

Token MASTER berlaku 365 hari.

---

## 5. Sistem Login VIP

Login VIP berbasis akun Supabase Auth.

User login dengan:

- nomor WhatsApp,
- password dari admin.

Nomor WhatsApp dinormalisasi menjadi format Indonesia:

- `081234567890` menjadi `6281234567890`
- `81234567890` menjadi `6281234567890`
- `6281234567890` tetap sama

Email internal Supabase dibuat dari nomor WhatsApp:

```txt
6281234567890@vip.local
```

Password tidak disimpan di tabel custom secara plain text. Password dikelola oleh Supabase Auth.

Setelah Supabase Auth menerima password, server mengecek data di `vip_profiles`. Jika valid, server menerbitkan JWT aplikasi.

Payload token berisi:

```json
{
  "role": "PRO",
  "accountId": "supabase-user-id",
  "phone": "6281234567890",
  "sessionId": "random-uuid",
  "tokenVersion": 2
}
```

Token disimpan di browser melalui localStorage sebagai:

```txt
supreme_token
```

---

## 6. Sistem Satu Akun Satu Sesi Aktif

Aplikasi menerapkan satu akun hanya boleh memiliki satu sesi VIP aktif.

Saat user login:

1. Server membuat `sessionId` baru.
2. Server menyimpan sessionId tersebut ke `vip_profiles.active_session_id`.
3. Token yang dikirim ke browser berisi sessionId yang sama.

Saat user mengakses API VIP:

1. Server membaca token dari header Authorization.
2. Server memverifikasi JWT.
3. Server mengecek `accountId` dan `sessionId` ke Supabase.
4. Jika `token.sessionId` berbeda dari `vip_profiles.active_session_id`, request ditolak.

Contoh:

```txt
Browser A login:
active_session_id = session_A
Token A berisi session_A

Browser B login akun yang sama:
active_session_id = session_B
Token B berisi session_B

Browser A akses API:
session_A != session_B
Request ditolak
```

Efeknya, user yang membagikan akun akan saling menendang sesi.

---

## 7. Sistem Penalty Anti-Sharing

Selain satu sesi aktif, sistem juga memiliki penalty untuk mencegah akun dipakai bergantian terlalu sering.

Aturan saat ini:

- Login pertama tanpa sesi aktif tidak dihitung switch.
- Login berikutnya saat akun sudah punya sesi aktif dihitung sebagai session switch.
- Maksimal session switch dalam 24 jam: 3.
- Switch ke-4 dalam 24 jam membuat akun dikunci sementara selama 24 jam.

Konstanta ada di:

```txt
app/api/account-login/route.ts
```

Nilai utama:

```ts
const SWITCH_WINDOW_MS = 24 * 60 * 60 * 1000;
const PENALTY_MS = 24 * 60 * 60 * 1000;
const MAX_SWITCHES_PER_WINDOW = 3;
```

Jika penalty aktif, endpoint login mengembalikan HTTP status:

```txt
423 Locked
```

User tetap dapat memakai aplikasi sebagai Free, tetapi tidak dapat login VIP sampai masa penalty selesai.

---

## 8. Environment Variables

Environment variable wajib diatur di Vercel dan local development.

### 8.1 Wajib

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
JWT_SECRET=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

### 8.2 Opsional / Kondisional

```env
SUPABASE_ANON_KEY=
INTERNAL_API_SECRET=
```

Keterangan:

- `SUPABASE_URL` digunakan oleh server route.
- `SUPABASE_SERVICE_ROLE_KEY` digunakan oleh server untuk akses admin Supabase. Jangan expose ke client.
- `JWT_SECRET` digunakan untuk sign dan verify token aplikasi.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` digunakan untuk login via Supabase Auth password grant.
- `SUPABASE_ANON_KEY` dapat dipakai sebagai fallback server-side jika public anon key tidak tersedia.
- `INTERNAL_API_SECRET` dipakai untuk request internal yang boleh bypass guard tertentu.

Jangan pernah commit file `.env` yang berisi credential asli.

---

## 9. Struktur Database Supabase

Bagian ini berisi struktur penting yang dipakai sistem VIP. Struktur tabel analisa seperti markets, market_statistics, dan analysis_evaluations dapat disesuaikan dengan evaluator/importer data yang digunakan.

### 9.1 vip_profiles

Tabel ini menyimpan status VIP user.

Minimal kolom yang dibutuhkan:

```sql
create table if not exists vip_profiles (
  user_id uuid primary key,
  phone text not null unique,
  role text not null check (role in ('PRO', 'MASTER')),
  expires_at timestamptz,
  is_active boolean not null default true,
  suspended_at timestamptz,
  active_session_id text,
  active_session_at timestamptz,
  last_login_ip_hash text,
  last_login_user_agent_hash text,
  penalty_until timestamptz,
  penalty_reason text,
  session_switch_count int not null default 0,
  session_switch_window_start timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Jika tabel sudah ada, tambahkan kolom berikut:

```sql
alter table vip_profiles
add column if not exists active_session_id text,
add column if not exists active_session_at timestamptz,
add column if not exists last_login_ip_hash text,
add column if not exists last_login_user_agent_hash text,
add column if not exists penalty_until timestamptz,
add column if not exists penalty_reason text,
add column if not exists session_switch_count int not null default 0,
add column if not exists session_switch_window_start timestamptz,
add column if not exists suspended_at timestamptz,
add column if not exists updated_at timestamptz not null default now();
```

### 9.2 vip_login_events

Tabel ini menyimpan log login untuk monitoring.

```sql
create table if not exists vip_login_events (
  id bigserial primary key,
  user_id uuid,
  phone text not null,
  ip_hash text not null,
  user_agent_hash text not null,
  success boolean not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists vip_login_events_user_id_idx on vip_login_events(user_id);
create index if not exists vip_login_events_phone_idx on vip_login_events(phone);
create index if not exists vip_login_events_created_at_idx on vip_login_events(created_at desc);
```

### 9.3 Auth Users

Akun login dibuat di Supabase Auth.

Email internal menggunakan format:

```txt
<phone>@vip.local
```

Contoh:

```txt
6281234567890@vip.local
```

Password diatur di Supabase Auth, bukan disimpan di `vip_profiles`.

### 9.4 markets

Tabel pasaran dipakai untuk daftar pasaran dan pencocokan nama/id.

Kolom yang umum dipakai:

```txt
id
name
updated_at
lastResult atau field hasil terakhir sesuai mapping API
```

Pastikan endpoint `/api/markets` mengembalikan array pasaran.

### 9.5 market_statistics

Tabel ini dipakai halaman Statistik VIP.

Kolom yang sering dipakai oleh route statistik:

```txt
market_id
group_key
mode
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

Jika statistik tidak tampil untuk VIP, cek:

- apakah token VIP dikirim di header Authorization,
- apakah data `market_statistics` ada,
- apakah `is_active = true`,
- apakah data memenuhi filter `wins_15`, `wins_last_5`, dan `max_loss_streak`,
- apakah scope/mode/param cocok dengan query UI.

### 9.6 analysis_evaluations

Tabel ini dipakai Riwayat Evaluasi VIP.

Kolom yang sering dipakai:

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

Jika riwayat evaluasi kosong, cek:

- apakah user VIP,
- apakah token dikirim,
- apakah marketId cocok,
- apakah mode/param/target_pair/analysis_scope cocok,
- apakah evaluator sudah menulis data ke tabel.

---

## 10. Membuat Akun VIP Manual

Alur yang disarankan:

1. User mengirim nomor WhatsApp ke admin.
2. Admin membuat user di Supabase Auth.
3. Admin mengisi `vip_profiles` dengan user_id dari Supabase Auth.
4. Admin memberikan password ke user.

Contoh mapping:

```txt
Nomor WA: 081234567890
Phone normalized: 6281234567890
Auth email: 6281234567890@vip.local
Role: PRO
Masa aktif: 60 hari
```

Contoh insert profile:

```sql
insert into vip_profiles (
  user_id,
  phone,
  role,
  expires_at,
  is_active
) values (
  'AUTH_USER_UUID_HERE',
  '6281234567890',
  'PRO',
  now() + interval '60 days',
  true
);
```

Untuk MASTER:

```sql
insert into vip_profiles (
  user_id,
  phone,
  role,
  expires_at,
  is_active
) values (
  'AUTH_USER_UUID_HERE',
  '6281234567890',
  'MASTER',
  now() + interval '365 days',
  true
);
```

---

## 11. Suspend dan Unsuspend Akun

Suspend akun:

```sql
update vip_profiles
set
  is_active = false,
  suspended_at = now(),
  updated_at = now()
where phone = '6281234567890';
```

Aktifkan kembali:

```sql
update vip_profiles
set
  is_active = true,
  suspended_at = null,
  penalty_until = null,
  penalty_reason = null,
  updated_at = now()
where phone = '6281234567890';
```

Reset penalty:

```sql
update vip_profiles
set
  penalty_until = null,
  penalty_reason = null,
  session_switch_count = 0,
  session_switch_window_start = null,
  updated_at = now()
where phone = '6281234567890';
```

Force logout semua sesi akun:

```sql
update vip_profiles
set
  active_session_id = null,
  active_session_at = null,
  updated_at = now()
where phone = '6281234567890';
```

---

## 12. API Routes Penting

### 12.1 `/api/account-login`

Method: POST

Fungsi:

- menerima nomor WA dan password,
- login ke Supabase Auth,
- cek profile VIP,
- cek expired/suspended/penalty,
- generate sessionId,
- update active_session_id,
- generate JWT,
- tulis log login.

Body:

```json
{
  "phone": "081234567890",
  "password": "password-vip"
}
```

Response sukses:

```json
{
  "success": true,
  "role": "PRO",
  "token": "jwt-token",
  "phone": "6281234567890",
  "expires_at": "2026-01-01T00:00:00.000Z",
  "session_switch_count": 0
}
```

Response penalty:

```json
{
  "success": false,
  "error": "Akun VIP dikunci sementara...",
  "penalty_until": "2026-01-01T00:00:00.000Z"
}
```

Status penalty:

```txt
423 Locked
```

### 12.2 `/api/verify`

Method: POST

Fungsi:

- memverifikasi JWT,
- mengecek sessionId masih aktif di server,
- mengembalikan role valid.

Dipakai saat app boot/refresh.

### 12.3 `/api/analyze`

Method: POST

Fungsi:

- menjalankan engine analisa,
- menjaga akses Free/VIP,
- menolak request yang tidak sesuai akses role,
- memvalidasi token VIP bila ada.

### 12.4 `/api/statistics`

Method: GET

Fungsi:

- mengambil ranking statistik pasaran,
- hanya bisa diakses VIP,
- membutuhkan Authorization Bearer token valid.

### 12.5 `/api/evaluations`

Method: GET

Fungsi:

- mengambil riwayat evaluasi,
- hanya bisa diakses VIP,
- membutuhkan Authorization Bearer token valid.

### 12.6 `/api/markets`

Method: GET

Fungsi:

- mengambil daftar pasaran untuk dashboard dan menu analisa.

---

## 13. Struktur Folder Penting

```txt
app/
  api/
    account-login/
    analyze/
    evaluations/
    markets/
    statistics/
    verify/
  analyze/
  pantauan-rekap/
  page.tsx

components/
  analysis/
  auth/
  history/
  layout/
  pwa/
  statistics/
  ui/
  upgrade/

lib/
  access/
  analysis/
  auth/
  markets/
  server/
```

Keterangan:

- `app/page.tsx`: dashboard pasaran.
- `app/analyze/[marketId]/page.tsx`: menu analisa pasaran.
- `app/analyze/[marketId]/[mode]/page.tsx`: halaman analisa per mode.
- `components/auth/VipLoginPanel.tsx`: panel login/status VIP.
- `components/upgrade/UpgradeLockPanel.tsx`: modal informasi fitur VIP terkunci.
- `lib/access/freeAccess.ts`: pusat aturan Free/VIP.
- `lib/server/jwt.ts`: sign/verify JWT aplikasi.
- `lib/server/vip-session.ts`: validasi sessionId aktif.
- `lib/server/supabase-admin.ts`: Supabase service role client server-side.

---

## 14. Development Lokal

Install dependency:

```bash
npm install
```

Jalankan development server:

```bash
npm run dev
```

Build production:

```bash
npm run build
```

Start production lokal:

```bash
npm run start
```

Typecheck:

```bash
npm run typecheck
```

Lint:

```bash
npm run lint
```

Format:

```bash
npm run format
```

---

## 15. Deployment Vercel

Deployment utama menggunakan Vercel.

Checklist sebelum deploy:

1. Semua env wajib sudah diisi di Vercel.
2. Supabase Auth aktif.
3. Tabel `vip_profiles` tersedia.
4. Tabel `vip_login_events` tersedia.
5. Tabel data pasaran/statistik/evaluasi tersedia.
6. Branch yang dideploy benar.
7. Build `npm run build` sukses.

Catatan Node.js:

`package.json` menggunakan:

```json
{
  "engines": {
    "node": ">=20.9.0"
  }
}
```

Vercel dapat otomatis naik major Node.js di masa depan. Jika ingin stabil, pin versi Node.js secara lebih spesifik di Vercel atau `package.json`.

---

## 16. Testing Manual Setelah Deploy

### 16.1 Test Free

1. Buka aplikasi tanpa login.
2. Pastikan dashboard tampil.
3. Buka salah satu pasaran.
4. Pastikan Angka Ikut 2D Belakang bisa dipakai.
5. Pastikan Angka Mati bisa dipakai.
6. Pastikan BBFS, Jumlah Mati, Shio Mati, Statistik, Riwayat Evaluasi, dan Rekap terkunci.
7. Klik fitur terkunci dan pastikan modal menjelaskan fungsi fitur dengan profesional.

### 16.2 Test Login VIP

1. Buka menu VIP.
2. Masukkan nomor WA dan password.
3. Pastikan login sukses.
4. Buka fitur VIP.
5. Pastikan Statistik tampil.
6. Pastikan Riwayat Evaluasi tampil jika data tersedia.
7. Pastikan Rekap dapat digunakan.

### 16.3 Test Satu Akun Satu Sesi

1. Login akun VIP di browser A.
2. Login akun yang sama di browser B.
3. Refresh browser A.
4. Browser A harus kembali Free atau token invalid.
5. Akses fitur VIP dari browser A harus gagal.
6. Browser B tetap valid.

### 16.4 Test Penalty

1. Login akun VIP di browser A.
2. Login akun yang sama di browser B.
3. Login lagi di browser A.
4. Login lagi di browser B.
5. Login berikutnya harus terkena penalty jika sudah melebihi batas switch.
6. Panel VIP harus menampilkan pesan kunci sementara.

---

## 17. Troubleshooting

### 17.1 Statistik tidak tampil padahal VIP

Cek:

- token tersimpan di localStorage sebagai `supreme_token`,
- request `/api/statistics` membawa header Authorization,
- token belum expired,
- `active_session_id` cocok dengan token sessionId,
- data `market_statistics` tersedia,
- filter statistik tidak terlalu ketat.

### 17.2 Riwayat Evaluasi tidak tampil

Cek:

- user sudah VIP,
- token dikirim ke `/api/evaluations`,
- tabel `analysis_evaluations` berisi data,
- marketId cocok,
- mode/param/target_pair/analysis_scope cocok.

### 17.3 Login VIP gagal

Cek:

- nomor WA sudah dinormalisasi benar,
- email Supabase Auth sesuai `<phone>@vip.local`,
- password benar,
- `vip_profiles.user_id` sama dengan Auth user id,
- `vip_profiles.phone` sama dengan nomor normalisasi,
- `is_active = true`,
- `suspended_at is null`,
- `expires_at` belum lewat,
- `penalty_until` tidak aktif.

### 17.4 Token lama masih ada tapi VIP gagal

Kemungkinan akun login di device/browser lain. Token lama tidak valid jika sessionId sudah diganti di `vip_profiles.active_session_id`.

Solusi:

- login ulang,
- atau reset sesi aktif dari Supabase jika perlu.

### 17.5 Build error karena module not found

Biasanya ada import lama yang file-nya sudah dihapus atau diganti.

Cari di repository:

```txt
PinActivationPanel
deviceId
displayCode
```

Jika masih ada, hapus import dan pemakaiannya.

---

## 18. Prinsip Keamanan

- Jangan simpan password VIP di tabel custom.
- Gunakan Supabase Auth untuk password.
- Jangan expose `SUPABASE_SERVICE_ROLE_KEY` ke client.
- Semua route VIP harus cek token server-side.
- UI lock hanya untuk pengalaman user, bukan keamanan utama.
- Backend guard adalah sumber keamanan utama.
- Token lama harus ditolak jika sessionId tidak cocok dengan active_session_id.
- Suspended account harus ditolak saat login dan saat validasi session.

---

## 19. Catatan Produk

Aplikasi ini membantu proses analisa berbasis data dan metode historis. Hasil analisa tidak boleh dianggap sebagai jaminan hasil. User tetap perlu menggunakan pertimbangan sendiri dan mengelola risiko.

Fitur VIP dibuat bukan hanya sebagai paywall, tetapi juga untuk menjaga beban server karena fitur seperti statistik, riwayat evaluasi, dan rekap membutuhkan query dan pemrosesan yang lebih berat.

---

## 20. Roadmap Teknis yang Disarankan

Prioritas berikutnya:

1. Admin panel pembuatan akun VIP.
2. Reset password VIP dari admin panel.
3. Monitoring akun dengan banyak penalty.
4. Dashboard admin untuk melihat login events.
5. Tombol suspend/unsuspend dari admin panel.
6. Export data statistik.
7. Build evaluator scheduler yang lebih terstruktur.
8. Tambah unit test untuk `freeAccess.ts`.
9. Tambah integration test untuk `/api/account-login`.
10. Tambah audit log untuk perubahan role dan masa aktif.

---

## 21. File Penting Saat Mengubah Sistem Akses

Jika ingin mengubah fitur Free/VIP, mulai dari:

```txt
lib/access/freeAccess.ts
```

Lalu cek UI yang menampilkan copy fitur:

```txt
components/auth/VipLoginPanel.tsx
components/upgrade/UpgradeLockPanel.tsx
components/analysis/ParamSelector.tsx
components/analysis/ScopeSelectors.tsx
app/analyze/[marketId]/page.tsx
components/layout/AppShell.tsx
```

Route backend yang harus tetap sinkron:

```txt
app/api/analyze/route.ts
app/api/statistics/route.ts
app/api/evaluations/route.ts
app/api/verify/route.ts
app/api/account-login/route.ts
```

---

## 22. Lisensi dan Akses

Repository ini bersifat private/internal. Jangan membagikan credential, service role key, atau data user ke pihak luar.
