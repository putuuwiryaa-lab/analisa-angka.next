# Adaptive Audit — 2026-08-06

Scope audit:

- online replay dan pembaruan bobot;
- settlement backlog;
- reconciliation concurrency;
- snapshot publication;
- evaluation dan guardrail observability;
- optimizer serta normalisasi probabilitas.

## Temuan yang diperbaiki

### 1. Stale concurrent reconciliation write

Dua reconciliation dapat menghitung dari state yang sama secara paralel. Advisory lock lama hanya mengurutkan write, sehingga hasil yang dihitung dari context lama masih dapat menimpa state lebih baru.

Perbaikan: exact context token `expectedStateRevision + expectedHistoryFingerprint`, diverifikasi setelah advisory lock melalui migration 008.

### 2. Settlement backlog menyimpan weightsAfter yang terlalu maju

Ketika beberapa result tertinggal, audit settlement prediction tertua memakai bobot akhir setelah seluruh backlog diproses. Bobot state produksi tetap benar, tetapi delta bobot pada evaluation dashboard tidak mewakili satu result tersebut.

Perbaikan: `weightsAfter` settlement dihitung ulang sebagai posterior tepat satu langkah dari prediction yang dievaluasi.

### 3. Evaluasi non-settled masih dapat terbaca

Prediction yang pernah settled dapat diaktifkan kembali menjadi pending saat cutoff lama diterbitkan ulang. Row evaluasi historis tetap tersimpan dan sebelumnya masih ikut dashboard.

Perbaikan: dashboard evaluasi hanya membaca prediction berstatus `settled`.

## Temuan pada PR terpisah

Guardrail Health sebelumnya mencampur drift event lintas engine/config dan menghitung histori prediction yang tidak lagi settled. Perbaikan berada pada PR version-scope terpisah.

## Area yang diperiksa tanpa perubahan

- exponential-loss weight update dan fixed-share;
- normalisasi bobot family/horizon;
- normalisasi matriks 100 pasangan dan marginal;
- Brier loss pair/left/right;
- optimizer AI/BBFS 1–9;
- keunikan digit dan deterministic tie-break;
- settlement satu prediction per reconciliation untuk backlog;
- publikasi atomik 18 selection;
- freshness reader Adaptive dan Batch.

Tidak ditemukan bug tambahan yang cukup kuat untuk mengubah rumus, optimizer, atau struktur pembelajaran.

## Deployment

1. Deploy Adaptive service dan aplikasi dari commit hasil merge.
2. Jalankan migration 008 pada Neon.
3. Jalankan reconciliation manual.
4. Pastikan output menunjukkan snapshot lengkap 18 selection dan tidak ada error concurrency berulang.

Migration 008 tidak boleh dijalankan sebelum service baru terpasang karena payload lama belum membawa context token.
