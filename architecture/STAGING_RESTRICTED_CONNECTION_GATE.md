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
