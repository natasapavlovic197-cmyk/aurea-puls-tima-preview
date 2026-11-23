# AUREA V4 — consolidated staging integration results

Date: 2026-11-23. Environment: existing Supabase `aurea-puls-staging`.

## Executed cross-tenant SQL role tests

Used a transaction with a temporary synthetic second organization and synthetic unknown user claim, `SET LOCAL ROLE authenticated`, and explicit `ROLLBACK`. The temporary organization was **not persisted**.

| Scenario | Result |
|---|---|
| Unknown identity lists companies | PASS — zero |
| Unknown identity accesses original organization cycles | PASS — denied |
| Unknown identity accesses synthetic organization cycles | PASS — denied |
| Existing member lists their organization | PASS — exactly one |
| Existing member accesses synthetic organization cycles | PASS — denied |

These are PostgreSQL role/JWT-claim simulations against real staging RPCs, **not** end-to-end authentication/HTTP tests with real test accounts. Do not present as proof of production readiness.

## Existing components and gaps

- Database already has organizations, memberships, cycles, questions, invitations, responses, answers, actions and manager RPCs.
- `pulse_summary` applies >=5 cycle responses and >=5 rated answers per question, but repeated-release differencing and timestamp correlation remain unmitigated.
- Invitation RPCs currently are not executable by `anon`/`authenticated`; server-mediated redemption is not implemented.
- Deterministic weekly job planner and in-memory token/tenant simulation exist in `architecture/`, with CI checks.
- No real email sending, persistent job execution, new user provisioning, UI/backend connection or production deployment.

## Pilot gates

1. Create two genuine staging Auth accounts and organizations only under an agreed test identity plan; run HTTP RPC positive/negative tests.
2. Eliminate timing-linkage and differencing risks in aggregate publishing; establish retention/deletion policy.
3. Implement server-side invitation redemption and job persistence, sandbox-only mail.
4. Connect staging manager UI without any privileged browser credentials.
5. Complete mobile QA and restore broken full QA workflow before a client demonstration.
