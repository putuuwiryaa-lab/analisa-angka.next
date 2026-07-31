# Deployment ke Deno Deploy

Aplikasi ini memakai Next.js App Router, Route Handlers, middleware akses PIN, Supabase, dan runtime Node compatibility dari Deno.

## 1. Buat aplikasi

1. Buka `console.deno.com`.
2. Buat organization dan application baru.
3. Hubungkan repository `putuuwiryaa-lab/analisa-angka.next`.
4. Pilih production branch `main`.
5. Gunakan application directory `/`.

Konfigurasi build dibaca dari `deno.json`:

- framework: `nextjs`
- install: `deno install --allow-scripts`
- build: `deno task build`

Installer native Deno dipakai karena `pnpm` pada builder Deno berjalan melalui compatibility shim dan pada dependency tree aplikasi ini dapat melewati batas memory saat tahap install.

## 2. Environment variables

### Build, Production, dan Development

Variabel public berikut harus tersedia pada konteks Build karena dapat dimasukkan ke bundle browser:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_ADMIN_CONTACT_URL=
```

### Production dan Development

Variabel server berikut tidak boleh diekspos ke browser:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ACCESS_SECRET=
ADMIN_PASSWORD=
INTERNAL_API_SECRET=
```

`INTERNAL_API_SECRET` opsional jika tidak ada service eksternal yang memanggil `/api/analyze`.

Pertahankan nilai `ACCESS_SECRET` lama agar hash PIN dan session yang sudah ada tetap valid. Pertahankan `INTERNAL_API_SECRET` yang sama jika service Render masih memanggil API internal.

Jangan aktifkan bypass Render pada Deno:

```env
TEMPORARY_DISABLE_PIN=false
```

Variabel itu sebaiknya tidak dibuat sama sekali pada Deno.

## 3. Deployment pertama

1. Jalankan deployment dari branch atau preview terlebih dahulu.
2. Pastikan tahap Install menjalankan `deno install --allow-scripts`.
3. Pastikan tahap Build menjalankan `deno task build`.
4. Jangan pindahkan domain sebelum pengujian selesai.

## 4. Troubleshooting install memory

Jika log berhenti pada `pnpm install` dengan pesan memory limit 3072 MiB, berarti revision masih memakai konfigurasi lama. Pastikan commit terbaru sudah terambil dan Config source menunjukkan `deno.json deploy section`, lalu jalankan ulang deployment.

Build Free menyediakan 3 GB RAM. Mengganti installer ke Deno lebih tepat daripada mencoba menambah memory, karena 4 GB hanya tersedia pada plan yang mendukungnya.

## 5. Checklist pengujian

- `/pin` terbuka untuk user tanpa cookie.
- Aktivasi PIN menghasilkan cookie akses dan device.
- Refresh tidak menghapus login.
- `/admin/login` dan `/admin` bekerja.
- Generate dan revoke PIN bekerja.
- Revoke session langsung menutup akses user.
- `/api/markets` dan histori market bekerja.
- Analyze, Scan, dan Batch Scan selesai tanpa timeout.
- Statistik, Evaluasi, Invest, dan Angka Jadi memuat data.
- Logout menghapus cookie.
- Service worker tidak menyajikan cache deployment lama.
- Rate limit PIN mencatat IP secara benar.

## 6. Domain

Setelah preview stabil:

1. Tambahkan `analisa-angka.site` dan `www.analisa-angka.site` pada Deno Deploy.
2. Ikuti record DNS yang diberikan Deno.
3. Tunggu verifikasi DNS dan sertifikat TLS aktif.
4. Pindahkan traffic ke Deno.
5. Pertahankan Render sebagai fallback sampai deployment Deno stabil.

## 7. Catatan kompatibilitas

- `deno.json` mengaktifkan opsi kompatibilitas yang direkomendasikan untuk Next.js.
- `nodeModulesDir` diset ke `auto` agar dependency npm tersedia melalui `node_modules`.
- Modul server memakai import eksplisit `node:crypto` dan `node:buffer`.
- Komponen Vercel Analytics tidak dirender lagi karena aplikasi tidak berjalan di Vercel.
- Dependency `@vercel/analytics` masih tercatat pada pnpm lockfile dan dapat dibersihkan saat lockfile diregenerasi secara lokal.
- Bypass PIN tetap hanya berlaku untuk hostname `.onrender.com` dan hanya jika `TEMPORARY_DISABLE_PIN=true`.

## 8. Rollback

Jika deployment Deno gagal setelah domain dipindahkan, kembalikan DNS ke endpoint Render. Database Supabase tidak perlu dimigrasikan karena tetap menjadi sumber data utama.
