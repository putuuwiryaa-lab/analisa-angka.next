# Adaptive Guardrail Operational Health

Endpoint internal `POST /guardrail/health` memvalidasi migration dan runtime guardrail untuk satu market serta target 2D.

Status operasional:

- `migration_required`: salah satu objek migration 004 belum tersedia.
- `waiting_for_state`: migration lengkap, tetapi state engine belum terbentuk.
- `waiting_for_run`: state tersedia, tetapi belum ada run pascamigrasi yang menyimpan fingerprint.
- `warmup`: fingerprint tersimpan dan detector aktif, tetapi sampel settlement masih di bawah 10.
- `active`: detector memiliki minimal 10 settlement live.

Objek migration yang diperiksa:

1. kolom `adaptive.engine_states.history_fingerprint`;
2. fungsi `adaptive.persist_guardrail(jsonb)`;
3. tabel `adaptive.drift_events`.

Health tetap bersifat observe-only. Status ini tidak mengubah formula, bobot, konfigurasi, atau melakukan rollback otomatis.
