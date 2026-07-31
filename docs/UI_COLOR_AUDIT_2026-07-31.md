# Audit Warna UI — Analisa Angka

Tanggal audit: 31 Juli 2026  
Target: `putuuwiryaa-lab/analisa-angka.next`

## Keputusan desain

Perubahan dibatasi secara ketat pada warna. Layout, spacing, ukuran, radius, struktur kartu, header, navigasi, urutan konten, dan perilaku komponen tetap memakai implementasi asli.

Tema lama memakai canvas navy hampir hitam dengan beberapa surface yang luminansinya terlalu berdekatan. Akibatnya kartu mudah menyatu dengan background dan keseluruhan aplikasi terasa suram. Tema putih penuh juga ditolak karena membuat UI terlalu flat dan kehilangan karakter.

Arah final adalah **bright soft-dark**: tetap gelap, tetapi canvas dan kartu dinaikkan luminansinya, kontras antarlapisan diperjelas, dan aksen dibuat lebih segar.

## Sistem warna final

### Fondasi

| Token | Nilai | Fungsi |
|---|---:|---|
| `--color-bg` | `#1A1D2E` | Canvas utama |
| `--color-bg-deep` | `#141624` | Area paling dalam dan navigation backdrop |
| `--color-surface` | `#25283B` | Card utama |
| `--color-surface-2` | `#2D3148` | Card sekunder dan input |
| `--color-surface-pressed` | `#3B405C` | Selected/pressed surface |
| `--color-text` | `#F9FAFF` | Teks utama |
| `--color-text-muted` | `#D8DEF0` | Teks sekunder |
| `--color-text-soft` | `#AAB5D0` | Label dan metadata |
| `--color-text-faint` | `#7C879F` | Placeholder dan teks tersier |
| `--color-primary` | `#8B7CF6` | Identitas dan aksi utama |
| `--color-primary-soft` | `#B3A6FF` | Aksen primary lembut |
| `--color-accent` | `#48C6E8` | Highlight dan result |
| `--color-success` | `#57D6A6` | Status berhasil |
| `--color-danger` | `#FF6F85` | Error dan destructive state |

### Mode analisa

| Mode | Nilai |
|---|---:|
| AI | `#F5C761` |
| BBFS | `#F5A65B` |
| Angka Mati | `#FF7893` |
| Jumlah | `#47D7C2` |
| Shio | `#52C7E8` |
| Rekap | `#7EAEFF` |
| Invest | `#C792FF` |
| Statistik | `#5EE0A0` |
| Scan | `#56CFE1` |

## Implementasi

Branch: `agent/modern-clean-color-system`

- `components/layout/ModernCleanTheme.tsx` hanya mengoverride token warna, background, warna surface, border, shadow, glow, dan warna per-mode.
- `components/layout/AppShell.tsx` mempertahankan seluruh class layout asli; perubahan hanya memasang theme global.
- `components/ui/Logo.tsx` hanya mengganti warna gradient logo.
- Tidak ada perubahan pada engine, API, Supabase, autentikasi, routing, isi menu, ukuran, spacing, atau struktur komponen.

## Catatan audit lanjutan

Komponen yang memakai warna hard-coded perlu diperiksa melalui preview per route. Koreksi lanjutan tetap harus berupa pergantian warna saja, tanpa mengubah markup atau class layout.
