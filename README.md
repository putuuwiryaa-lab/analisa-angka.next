# Analisa Angka

Analisa Angka adalah aplikasi web/PWA berbasis Next.js untuk dashboard pasaran, analisa angka, Scan, statistik, evaluasi, rekomendasi Invest 2D, dan Angka Jadi.

## Stack

| Area | Teknologi |
|---|---|
| Runtime dan deploy | Deno Deploy |
| Framework | Next.js App Router |
| UI | React dan Tailwind CSS |
| Bahasa | TypeScript |
| Data | Supabase PostgreSQL |
| State data | TanStack React Query |

Repository ini tidak lagi memiliki konfigurasi Vercel atau Render. Semua task dan deployment dikendalikan melalui `deno.json`.

## Fitur

- Dashboard dan pencarian pasaran.
- Histori result market.
- Angka Ikut, BBFS, Angka Mati, Jumlah Mati, Shio Mati, dan Custom Rekap.
- Scan dan Batch Scan.
- Statistik dan riwayat evaluasi.
- Rekomendasi Invest 2D dan Angka Jadi.
- PWA dan service worker.
- Sistem PIN 8 digit serta panel admin untuk generate/revoke akses.

## Sistem akses

Sistem akses memakai tabel Supabase berikut:

```text
analisa_access_pins
analisa_access_sessions
analisa_rate_limits
```

PIN, session token, dan IP disimpan dalam bentuk hash HMAC menggunakan `ACCESS_SECRET`. Cookie user dan admin bersifat `httpOnly`, `sameSite=lax`, serta `secure` pada production.

Untuk pengenalan URL Deno, PIN dibypass sementara sampai **7 Agustus 2026 pukul 17.08 WITA**. Bypass hanya aktif pada Deno Deploy dan tidak menonaktifkan autentikasi admin. Setelah waktu tersebut, proteksi PIN aktif kembali otomatis.

## Environment variables

Public, tersedia pada Build, Production, dan Development:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_ADMIN_CONTACT_URL=
```

Server-only, tersedia pada Production dan Development:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ACCESS_SECRET=
ADMIN_PASSWORD=
INTERNAL_API_SECRET=
```

`INTERNAL_API_SECRET` bersifat opsional jika tidak ada service eksternal yang memanggil `/api/analyze`.

Jangan commit credential asli dan jangan expose `SUPABASE_SERVICE_ROLE_KEY` ke browser.

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

1. Hubungkan repository ke aplikasi Deno Deploy.
2. Gunakan branch `main` dan application directory `/`.
3. Isi environment variables sesuai context.
4. Deno membaca konfigurasi dari `deno.json`:
   - framework: `nextjs`
   - install: `deno install --allow-scripts`
   - build: `deno task build`
5. Uji seluruh halaman dan API melalui preview URL sebelum memasang custom domain.

Panduan lengkap tersedia di [`docs/DENO_DEPLOY.md`](docs/DENO_DEPLOY.md).

## Struktur penting

```text
app/                 Next.js routes dan API
components/          UI, analysis, layout, PWA
lib/analysis/        engine analisa
lib/server/          akses, Supabase admin, rate limit
proxy.ts             proteksi route dan redirect PIN
deno.json            task dan konfigurasi Deno Deploy
```

## Catatan

Aplikasi ini adalah alat bantu analisa berbasis data historis dan evaluasi sistem. Hasil analisa bukan jaminan hasil akhir.
