# Staging connectivity checkpoint — 2026-11-23

## Executed read-only checks

- GitHub privacy workflow for commits `8502428` and `b95fc74`: **success**.
- Staging project: `ublzmoroanhlcgpnxilw` (not the production AUREA website).
- `pg_roles`: `aurea_rate_limiter` exists with `rolcanlogin=false` and `rolbypassrls=false`.
- `pg_proc` privilege check: `public.aurea_manager_summary` is callable by `authenticated`, not by `anon`; employee invitation/submit RPCs are callable by neither `anon` nor `authenticated`.
- Supabase Security Advisor: seven private tables with RLS enabled but no policies (informational), five authenticated SECURITY DEFINER manager RPCs (warnings; review their authorization checks), and a password-protection warning. Advisor warnings are **not** evidence of an exploit.

## Blocking issue: real connection is not ready

The Netlify manager service expects a PostgreSQL login named `aurea_rate_limiter`. This role is **NOLOGIN**, so it cannot authenticate over PostgreSQL. No credentials were configured in Netlify and no real JWT-backed HTTP integration was tested. Therefore `AUREA_B2B_MANAGER_ENABLED` and `AUREA_B2B_MANAGER_DEPLOY_APPROVED` must remain unset/false. A passing mocked integration test does not remove this blocker.

## Required before enabling

1. Design and provision a **restricted LOGIN identity** with least privileges; verify it can connect over the selected Supabase pooling endpoint and that its `current_user` matches the expected identity. Do not use `postgres`, `service_role` or a bypass-RLS account for the limiter.
2. Reconcile the role identity with `architecture/restricted-pg-query.cjs` and deployment preflight. Do not weaken the runtime identity check to make tests pass.
3. Add a pinned `pg` dependency with a genuine npm lockfile and confirm Netlify function bundling; the preview currently has no npm build command.
4. Configure secrets **only** in server-side Netlify environment settings; never commit credentials.
5. Verify actual JWT authentication, membership-denied cross-tenant requests, privacy threshold, durable limiter behavior, and error handling over real staging HTTP.
6. Obtain explicit owner approval for a single controlled preview release; the published deploy is currently locked to conserve credits.

No database mutations, grants, secret changes, Netlify deployments, or billing changes were made by this checkpoint.
