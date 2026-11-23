# Staging restricted limiter role — 2026-11-23

Applied to Supabase staging project `ublzmoroanhlcgpnxilw`:
- Created `aurea_rate_limiter` role as **NOLOGIN, NOINHERIT**, without BYPASSRLS.
- Granted USAGE on `aurea_private` and SELECT/INSERT/UPDATE only on `aurea_private.api_rate_limits`.
- Created RLS policy on the limiter table scoped to `aurea_rate_limiter`.
- Verified `rolcanlogin=false`, `rolbypassrls=false`, `has_table_privilege('aurea_rate_limiter',...,'INSERT')=true`, `has_table_privilege('anon',...,'INSERT')=false`.
- Executed a transaction-scoped UPSERT with `RETURNING hits=1`, then ROLLBACK; confirmed test bucket row count remains zero.

**Important limitation:** the SQL executor refused `SET ROLE aurea_rate_limiter` (permission denied), so the test UPSERT ran as the existing privileged SQL session, NOT the restricted role. This proves SQL syntax/atomic upsert and rollback but **does not prove** that the restricted role can perform the operation at runtime.

**No login credentials or server connection are provisioned.** NOLOGIN role cannot directly authenticate. Before enabling the Netlify endpoint, decide a restricted connection strategy (dedicated LOGIN role with secure credentials, explicit role inheritance and audited RLS, or private server-only function), configure secrets in Netlify only, verify actual restricted-identity query and failure modes. Do not use service_role in browser. No production site changes.
