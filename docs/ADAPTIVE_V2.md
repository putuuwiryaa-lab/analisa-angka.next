# Adaptive V2 — 2D Belakang

Adaptive V2 memfokuskan seluruh production learning pada target `belakang` dan memanfaatkan reservoir maksimum 170 result 4D.

## Production contract

- Engine: `hf-apie-v2-back`
- Config: `2026-08-07.1`
- Target: `belakang`
- AI: 1–6 digit
- BBFS: 5–9 digit
- Selection per prediction: 11
- Maximum history reservoir: 170
- Historical replay warmup: 28
- Expert ensemble: 28 expert
- Global expert learning: online exponential weighting + fixed share
- Selection learning: 11 state independen dengan historical prequential bootstrap

AS dan KOP tidak lagi menjadi target publication, tetapi seluruh empat digit result tetap dapat digunakan oleh expert structural untuk memprediksi 2D belakang.

## Expert families

V2 menggunakan null baseline, positional frequency, direct pair, Bayesian pair, recency/adaptive decay, hierarchical transition, positional Markov, recurrence/gap, distribution momentum, adaptive regime window, full-4D structural conditionals, dan variable-order context.

Tidak semua expert memakai window yang sama. Expert long/structural/context dapat memakai seluruh reservoir 170; expert short/medium tetap dipertahankan untuk menjaga diversity time-scale.

## Bootstrap dan settlement

Pada state baru atau history correction, global weights dan 11 selection calibration state dipelajari secara prequential dari histori setelah warmup 28. Prediction untuk result ke-N hanya boleh membaca result sebelum N.

Pada rolling normal 170→170, engine hanya melakukan satu settlement/update incremental terhadap result terbaru dan menerbitkan prediction berikutnya.

## Database migration

Jalankan migration secara berurutan sampai:

`sql/neon/011_adaptive_v2_back_only.sql`

Migration 011 membutuhkan migration 010. V1 settled prediction/evaluation tidak dihapus. Pending V1 dibatalkan ketika V2 diaktifkan. Wrapper database tetap mempunyai jalur kompatibilitas untuk contract V1 selama rollout, sedangkan snapshot V2 final disimpan dengan tepat 11 selection.

## Deployment order

1. Pastikan migration 001–010 sudah aktif.
2. Terapkan migration 011 pada Neon.
3. Deploy `adaptive-engine-service` dan aplikasi dari commit yang sama.
4. Jalankan reconciliation untuk bootstrap state V2 `belakang` pada market aktif.
5. Pastikan snapshot baru melaporkan 11 publication dan 11 calibration state.

Karena engine/config version berubah, V1 state tidak akan dipakai sebagai state V2. Historical V1 tetap tersedia untuk audit.
