# Adaptive boundary

Adaptive V2 production learning dan reconciliation hidup di `adaptive-service/*`.

## Production path

1. Histori market dibaca oleh `adaptive-service/reconcile.mts`.
2. Engine authoritative berada di `adaptive-service/core/*`.
3. Prediction, settlement, calibration state, dan published snapshot disimpan oleh Adaptive Service.
4. Next.js UI/API membaca published snapshot melalui `lib/adaptive/persistence.ts`.
5. Request UI normal tidak menjalankan learning atau reconciliation lokal.

## `lib/adaptive/*`

Folder ini berisi client/read-model, validator snapshot, shared contract untuk UI, serta beberapa helper/mirror lama yang masih dipakai regression test.

`lib/adaptive/engine.ts` dan `lib/adaptive/learning.ts` **bukan** engine reconciliation production. Jangan menambahkan writer path baru dari UI ke modul tersebut. Perubahan algoritma production harus dilakukan pada `adaptive-service/core/*` dan dilindungi regression test di sana.

Jika mirror lama dipertahankan, kontraknya harus tetap V2 back-only dan tidak boleh menjadi sumber kebenaran kedua untuk rolling-window settlement.
