# Backup Recovery — 2026-08-05

Created after deployment billing failure prevented new jobs from starting.

## Protected Git References

- Stable production snapshot branch: `backup/2026-08-05-main-stable`
- Adaptive full-publication source snapshot: `backup/2026-08-05-adaptive-full-publication`
- Recovery manifest branch: `backup/2026-08-05-recovery-manifest`
- Stable main commit at backup time: `980e1a48efc3fe8b2c74fae6224312c51e16133b`
- Adaptive PR #89 source commit: `f604b5ac58e0537cf853022a1ba0ba3d2432fc37`

## Runtime Applications

- Web application: `analisaangka-next`
- Adaptive service: `adaptive-engine-service`

The source code is stored in GitHub and does not depend on the deployment provider account remaining active.

## Database State

Neon migrations expected in order:

1. `sql/neon/001_adaptive_engine.sql`
2. `sql/neon/002_adaptive_online_learning.sql`
3. `sql/neon/003_adaptive_reconciliation.sql`
4. `sql/neon/004_adaptive_guardrails.sql`
5. `sql/neon/005_adaptive_full_publication.sql`

Migration 005 was reported as executed successfully on 2026-08-05.

Database contents are not included in this Git branch. Export Supabase and Neon separately using their provider backup/export tools.

## Required Environment Variable Names

Do not store secret values in Git.

Web application:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_ADMIN_CONTACT_URL
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ACCESS_SECRET
ADMIN_PASSWORD
INTERNAL_API_SECRET
ADAPTIVE_SERVICE_URL
ADAPTIVE_SERVICE_SECRET
```

Adaptive service:

```text
NEON_DATABASE_URL
ADAPTIVE_SERVICE_SECRET
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Optional migration/admin connection:

```text
NEON_DIRECT_URL
```

## Recovery Order

1. Create or select a replacement runtime account.
2. Deploy the Adaptive service from `backup/2026-08-05-adaptive-full-publication`.
3. Restore the service environment variables.
4. Confirm Neon migrations 001–005 are installed.
5. Verify service health and run reconciliation for one market.
6. Deploy the web app from the same branch or use `backup/2026-08-05-main-stable` for the last stable release.
7. Restore web environment variables.
8. Verify `/api/markets`, Adaptive context loading, reconciliation, and persistence.

## Critical Warning

A GitHub branch protects source code and migrations, but it does not back up:

- Supabase table data
- Neon table data
- deployment environment variable values
- custom domains and DNS
- provider-specific schedules or billing configuration

Export those separately as soon as access is available.
