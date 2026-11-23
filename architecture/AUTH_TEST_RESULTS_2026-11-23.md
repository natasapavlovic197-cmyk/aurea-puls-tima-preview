# Staging auth simulation results — 2026-11-23

Read-only SQL checks on existing Supabase staging project. No account created, no table rows changed. Test statements used `SET LOCAL ROLE authenticated`, session-scoped `request.jwt.claim.sub`, and `ROLLBACK`. This simulates role/claim context at SQL level; it **does not replace** tests using real signed-in user sessions.

| Check | Observed | Assessment |
|---|---|---|
| Unknown UUID identity calls `public.aurea_my_companies()` | 0 companies | PASS (negative) |
| Existing member UUID calls `public.aurea_my_companies()` | 1 company | PASS (positive) |
| Unknown UUID identity calls `public.aurea_manager_summary()` for unrelated UUID | PostgreSQL 42501 Access denied | PASS (negative) |

Known limitation: database currently has one organization and one auth user. Real cross-tenant checks with two authenticated test users, two organizations, and HTTP RPC requests **remain pending**. No assertion of complete tenant isolation or production readiness.

Privacy note: `aurea_private.pulse_summary` uses a minimum of five responses per closed cycle and five rated answers per question. This is a useful threshold but does not by itself mitigate repeated-release differencing or timestamp linkage.

Next: provision second *synthetic* test company and user only after verifying auth/test identity setup, then run HTTP-level positive/negative checks for every manager RPC, action update, invitation replay, and aggregate suppression. Avoid changing public demo or live employee data.
