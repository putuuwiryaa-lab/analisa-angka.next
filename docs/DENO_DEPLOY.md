# Deployment Deno Deploy

Repository ini menggunakan Deno Deploy sebagai satu-satunya target deployment.

## Konfigurasi aplikasi

- Framework preset: `nextjs`
- Production branch: `main`
- Application directory: `/`
- Install command: `deno install --allow-scripts`
- Build command: `deno task build`

Konfigurasi tersebut dibaca langsung dari `deno.json`. Next.js dibangun dengan Webpack dan dependency utama dipin ke versi exact agar hasil instalasi Deno tidak berubah antar-build.

## Environment variables

### Build, Production, dan Development

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_ADMIN_CONTACT_URL=
```

### Production dan Development

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ACCESS_SECRET=
ADMIN_PASSWORD=
INTERNAL_API_SECRET=
```

`INTERNAL_API_SECRET` opsional jika tidak ada service eksternal yang memanggil `/api/analyze`.

Jangan menaruh `SUPABASE_SERVICE_ROLE_KEY`, `ACCESS_SECRET`, `ADMIN_PASSWORD`, atau `INTERNAL_API_SECRET` pada Build context karena nilainya tidak dibutuhkan oleh bundle browser.

## PIN sementara

Proteksi PIN tetap tersedia. Untuk masa pengenalan URL Deno, bypass sementara aktif hanya ketika `DENO_DEPLOY=true` dan sebelum:

```text
7 Agustus 2026, 17.08 WITA
```

Setelah waktu tersebut, proteksi PIN aktif kembali otomatis. Halaman dan API admin tetap memerlukan login admin selama masa bypass.

## Validasi deployment

Setelah build berhasil, uji:

1. Halaman utama, pencarian market, dan histori.
2. Analyze untuk seluruh mode.
3. Scan dan Batch Scan.
4. Statistik dan Evaluasi.
5. Rekomendasi Invest dan Angka Jadi.
6. Login admin, generate PIN, revoke PIN, dan revoke session.
7. Service worker serta instalasi PWA.
8. Aktivasi PIN setelah masa bypass selesai.

## Domain

Tambahkan domain pada Settings Deno Deploy, ikuti record DNS yang diberikan, lalu tunggu verifikasi TLS. Tidak ada konfigurasi Vercel atau Render di repository.

## Pengembangan lokal

```bash
deno install --allow-scripts
deno task dev
deno task typecheck
deno task lint
deno task build
```

Deno Deploy menjalankan Next.js melalui compatibility layer Node/npm. Jangan mengganti dependency exact menjadi rentang `^` tanpa menguji build pada Deno Deploy terlebih dahulu.
