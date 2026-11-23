# AUREA staging — restricted database connection gate (2026-11-23)

Status: **BLOCKED / NOT DEPLOYABLE**. This is an evidence-backed gate, not a production authorization.

## Verified, read-only against staging project ublzmoroanhlcgpnxilw
- Existing role `aurea_rate_limiter`: `rolcanlogin=false`, `rolbypassrls=false`, `rolinherit=false`.
- `aurea_private` schema USAGE is granted to that role.
- Of ten private application tables, only `api_rate_limits` has SELECT/INSERT/UPDATE grants for that role. All ten have RLS enabled.
- The application currently insists on `current_user='aurea_rate_limiter'` before executing the exact counter query.
- Therefore the current staging manager service cannot connect as configured. A successful unit test is **not** proof of live connectivity.

## Safe next implementation sequence
1. Choose a restricted credential delivery method and validate Supabase's actual pooler endpoint/username/port/TLS certificate requirements. The current service hardcodes port 5432 and an `*.supabase.com` host check; do not assume it matches the selected pooler.
2. Provision a dedicated LOGIN identity **only after** secure secret handling is ready. Prefer a dedicated login with the minimum required permissions, not `postgres`, `service_role`, `authenticated`, or any BYPASSRLS role. Adapt the runtime identity assertion to the *specific verified role* without accepting arbitrary users or a runtime-supplied identity.
3. **Important RLS gate:** table privileges alone do not establish effective access. Verify the restricted role can atomically INSERT/UPDATE the rate-limit row under RLS. If it cannot, add a narrowly scoped, reviewed RLS policy or carefully audited private function. Never disable RLS to make the limiter work.
4. Pin `pg` with a committed genuine lockfile, confirm server-only Netlify bundling, and keep all secrets out of git and browser assets.
5. Verify live staging: actual DB identity; valid and invalid JWT; cross-company membership denial; privacy minimum of five; action writes and reload; atomic limiter under concurrency; fail-closed DB outage.
6. Review security advisors, record results, obtain explicit owner approval for a **single** preview release. Keep both `AUREA_B2B_MANAGER_ENABLED` and `AUREA_B2B_MANAGER_DEPLOY_APPROVED` disabled until then.

## Do not conflate
The two mobile browser QA workflows are green for the *static demo*. They do not exercise a real Supabase connection, employee submissions, multi-tenant permissions, or scheduled Monday/Wednesday/Friday notifications.

## Credit policy
No Netlify deployment, TinyFish run, paid resource provisioning, secret mutation, or billing change is authorized by this checklist.

## Read-only RLS policy verification (2026-11-23)
- The staging `pg_policies` catalog shows `aurea_rate_limit_server_only` on `aurea_private.api_rate_limits`, scoped to role `aurea_rate_limiter`, command `ALL`, with `USING (true)` and `WITH CHECK (true)`.
- Combined with the previously verified schema/table grants, this indicates that the **role's own** limiter upsert is permitted by policy once a valid SQL session runs as that role. This is **not a live transaction test** and does **not** resolve the role's `NOLOGIN` status.
- No grants, policies, roles, or secrets were changed during verification.

## Approved staging role membership applied (2026-11-23)
- Created earlier: `aurea_limiter_login` LOGIN role with **NULL password**, NOINHERIT, NOBYPASSRLS, no administrative powers.
- Applied: `GRANT aurea_rate_limiter TO aurea_limiter_login WITH INHERIT FALSE, SET TRUE` (PostgreSQL 17).
- Verified: membership `inherit_option=false`, `set_option=true`, `admin_option=false`; login still has **no direct USAGE** on `aurea_private` and **no direct INSERT** on the limiter table.
- Intended flow: restricted SQL session connects as `aurea_limiter_login`, then explicitly `SET ROLE aurea_rate_limiter` and validates `current_user` before limiter upsert. **Current application does not yet implement this flow**, and the role has no password, so live connection remains disabled.
- Do not configure a password via a chat transcript or commit. A server-side secret management plan, authenticated session identity test, and transaction/pool safety review are still required before enabling.

## Live activation checkpoint (2026-11-23)
- Latest GitHub B2B privacy suite succeeded (run 45205058677). This is a mock/unit suite, **not** an authenticated database integration test.
- Read-only catalog check confirmed login role has NULL password, NO BYPASSRLS, membership SET=true / INHERIT=false / ADMIN=false, and no direct SELECT on employee responses or INSERT on limiter table.
- Attempted `SET LOCAL ROLE aurea_rate_limiter` through the Supabase management SQL connection was rejected (permission denied). This connection is **not** `aurea_limiter_login`; the failure does not prove the app login cannot set role. Must verify through an actual dedicated-login session.
- Remaining blocker: no secure end-to-end password provisioning and secret injection path has been established. Never pass credentials via SQL tool logs, GitHub commits, chat, or frontend. The current DB account is deliberately unusable until that is solved.
- Keep Netlify manager deployment flags disabled and public endpoint fail-closed. Do not claim live manager integration or cross-tenant isolation until tested with two distinct authenticated organizations.
- Next controlled test: configure secret in provider secret manager, verify TLS/pooler username/host, connect as dedicated login, execute BEGIN/SET LOCAL ROLE/identity/allowlisted limiter UPSERT/COMMIT; confirm unauthorized tables denied; test invalid JWT, cross-tenant access, minimum aggregation threshold, concurrent limiter requests and outage fail-closed.
