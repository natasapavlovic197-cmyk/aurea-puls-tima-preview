# AUREA Puls tima — production readiness audit (2026-11-23)

## Evidence: read-only live Supabase function definitions
Project: `ublzmoroanhlcgpnxilw` (staging). Inspected `pg_get_functiondef` for manager RPCs, employee RPCs, and private summary function.

### Confirmed
- `public.aurea_manager_actions`, `aurea_manager_cycles`, `aurea_manager_save_action`, `aurea_manager_summary`: `SECURITY DEFINER`, `SET search_path TO ''`, explicit `auth.uid()` membership test on requested organization and role in `('owner','manager')`.
- `aurea_manager_save_action` validates description length, status, and optional cycle ownership; update filters by organization.
- `aurea_manager_summary` calls `aurea_private.pulse_summary(organization,5)`.
- `aurea_private.pulse_summary` includes only closed cycles with >=5 responses and only question-level aggregates with >=5 non-null ratings.
- `aurea_employee_invitation` checks hash syntax, expiration, redemption and open cycle, returning question wording when valid.
- `aurea_employee_submit` checks hash, one-time redemption, four distinct question codes, and ratings, locks invitation row before insertion and redemption.

### Not verified / blockers
1. No live cross-tenant HTTP test with two independent authenticated company users. Function code inspection alone is not a full authorization test.
2. No active employee Netlify endpoint: `netlify/functions/aurea-employee.cjs` deliberately returns 503. Employee RPCs are not exposed to `anon`/`authenticated` in current grants; a secure server gateway is required.
3. Weekly orchestrator is a deterministic planner with `simulated:true`, not an email scheduler. Monday/Wednesday/Friday sends are not active.
4. Netlify preview currently has no environment variables; no secret-backed manager database connection has been verified.
5. GitHub CI workflow is manual-only. Recent code changes need full suite run.
6. Employee submission SQL accepts additional JSON object fields and ratings expressed as strings; decide canonical schema before live exposure.
7. No verified privacy/retention legal package, billing workflow, customer onboarding or support process.
8. Check whether `questions.code` is unique and whether cross-cycle reuse is intentionally constrained before relying on lookup by code in `aurea_employee_submit`.
9. Confirm aggregate disclosure safety against small-group differencing across consecutive weeks; >=5 per week alone does not guarantee full anonymity.

## Safe launch gate
- [ ] Run full CI and targeted regression tests.
- [ ] Implement secure employee server boundary and durable abuse controls; test token replay, expiry and concurrency.
- [ ] Implement actual invite/reminder/report dispatch with idempotency and delivery observability.
- [ ] Test two real authenticated tenants and no cross-tenant access.
- [ ] Configure restricted DB credentials securely, verify real connection, and enable dual explicit activation flags only after checks.
- [ ] Approve data processing notices, contracts, retention and incident procedure.
- [ ] Complete pilot rehearsal and explicit deployment approval.

## Presentation boundary
For 25 Nov: use existing synthetic employee/manager demo. Do not represent backend scheduling, real data collection, or email delivery as live. Main AUREA site and Netlify deployment unchanged. No TinyFish usage.
