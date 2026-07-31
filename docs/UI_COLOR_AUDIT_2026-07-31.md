# Audit Warna UI — Analisa Angka

Tanggal audit: 31 Juli 2026  
Target: `putuuwiryaa-lab/analisa-angka.next`

## Ringkasan

Tema lama konsisten secara teknis karena memakai token global, tetapi hasil visualnya terlalu gelap dan suram untuk dashboard yang digunakan berulang kali. Kombinasi canvas navy hampir hitam, beberapa permukaan gelap dengan luminansi berdekatan, glow ungu, gradient bertumpuk, dan shadow hitam membuat hierarki antarkomponen kurang tegas.

Arah baru memakai sistem **modern clean light**: canvas off-white, kartu putih, teks slate, border tipis, shadow ringan, primary indigo, accent cyan, dan warna mode analisa yang lebih terkontrol.

## Temuan utama

1. `app/globals.css` menetapkan background `#0b0d16` dan `#080914`, dengan surface `#171329` dan `#172033`. Jarak luminansi antarlevel terlalu sempit sehingga banyak kartu terlihat menyatu.
2. Background halaman memakai tiga radial gradient dan satu linear gradient. Dikombinasikan dengan glow pada logo, kartu, dan tombol, hasilnya terasa berat.
3. Beberapa komponen memakai tint putih transparan seperti `bg-white/[0.035]`, `hover:bg-white/[0.07]`, dan `bg-white/10`. Kelas ini khusus untuk dark theme dan perlu diaudit bertahap setelah perubahan token global.
4. Navigasi bawah memakai canvas gelap transparan dan glow per-mode. Pada aplikasi data, navigasi lebih mudah dibaca bila menggunakan bar putih, border tipis, dan shadow ringan.
5. `data-mode="scan"` sudah digunakan pada navigasi, tetapi token warna Scan belum didefinisikan di theme utama. Akibatnya Scan jatuh ke warna primary umum.
6. Warna mode analisa cukup membantu orientasi, tetapi versi lama terlalu neon di atas permukaan gelap. Warna tersebut dipertahankan dengan saturasi dan luminansi yang lebih sesuai untuk background terang.

## Sistem warna baru

### Fondasi

| Token | Nilai | Fungsi |
|---|---:|---|
| `--color-bg` | `#F6F8FC` | Canvas utama |
| `--color-bg-deep` | `#FFFFFF` | Navigation bar dan on-primary text legacy |
| `--color-surface` | `#FFFFFF` | Card, input, panel |
| `--color-surface-2` | `#F8FAFC` | Secondary surface |
| `--color-surface-pressed` | `#E2E8F0` | Pressed/selected surface |
| `--color-text` | `#172033` | Teks utama |
| `--color-text-muted` | `#475569` | Teks sekunder |
| `--color-text-soft` | `#64748B` | Label dan metadata |
| `--color-text-faint` | `#94A3B8` | Placeholder dan teks tersier |
| `--color-primary` | `#5657D9` | Primary action dan identity |
| `--color-primary-soft` | `#6D6EE8` | Hover dan secondary primary |
| `--color-accent` | `#0891B2` | Result/highlight |
| `--color-success` | `#059669` | Status berhasil |
| `--color-danger` | `#DC2626` | Error dan destructive state |

### Mode analisa

| Mode | Nilai |
|---|---:|
| AI | `#B7791F` |
| BBFS | `#C2410C` |
| Angka Mati | `#E11D48` |
| Jumlah | `#0F766E` |
| Shio | `#0891B2` |
| Rekap | `#2563EB` |
| Invest | `#7C3AED` |
| Statistik | `#059669` |
| Scan | `#0E7490` |

## Prinsip visual

- Gunakan warna mode untuk orientasi, bukan sebagai background dominan.
- Kartu utama memakai putih dengan satu border dan satu shadow ringan.
- Gradient hanya untuk background global yang sangat halus atau accent card penting.
- Glow dihilangkan dari komponen rutin.
- Label kecil memakai uppercase seperlunya; konten utama tetap memakai kontras tinggi.
- Status sukses, peringatan, dan error harus dibedakan oleh warna serta teks/icon, bukan warna saja.

## Implementasi pada branch

Branch: `agent/modern-clean-color-system`

- `components/layout/ModernCleanTheme.tsx`: menyuntikkan override token global, background, surface depth, dan token Scan melalui elemen `<style>` app-wide. Jalur ini dipilih karena Deno gagal ketika stylesheet global tambahan diimpor dari `app/layout.tsx`.
- `components/layout/AppShell.tsx`: memasang theme override, membersihkan hero header, dan merapikan bottom navigation.
- `components/ui/Logo.tsx`: mengganti gradient logo ke indigo-cyan yang lebih modern.
- `docs/UI_COLOR_AUDIT_2026-07-31.md`: mendokumentasikan temuan, palette, dan batas scope.

## Validasi

- Deno Deploy berhasil setelah theme override dipindahkan dari global CSS import ke `ModernCleanTheme.tsx`.
- Perubahan hanya menyentuh lapisan visual dan dokumentasi; engine, API, Supabase, dan alur menu tidak diubah.

## Tahap lanjutan setelah review visual

1. Uji route utama pada mobile: `/`, `/analyze/[marketId]`, `/scan`, `/scan/batch`, `/pantauan-rekap`, dan `/rekomendasi`.
2. Periksa elemen yang masih memakai shadow, gradient, atau tint putih hard-coded.
3. Jalankan pemeriksaan kontras teks kecil dan state disabled.
4. Setelah visual disetujui, satukan token final ke `app/globals.css` agar theme kembali memiliki satu sumber utama.
