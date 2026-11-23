# AUREA staging database — verified read-only inventory (2026-11-23)

Project: `aurea-puls-staging` (Supabase, region eu-west-1). Existing project; **do not recreate**.

## Confirmed database objects

Schema `aurea_private` already contains:
- `organizations` (1 sample row), `memberships` (1)
- `questions` (4), `cycles` (2), `cycle_questions` (8)
- `invitations` (12), `responses` (12), `response_answers` (48)
- `manager_actions` (0)

All listed tables have RLS enabled. No policy was found on the response and invitation tables; they are not directly readable by ordinary API roles under default-deny RLS. `memberships` has a self-read policy; `manager_actions` has authenticated read/insert/update policies using membership, role and organization checks.

No `anon` or `authenticated` table grants appeared in the queried `information_schema.role_table_grants` output for the private schema. Confirm actual schema exposure and function grants before client integration.

## Important architecture reconciliation

Previous `SECURE_B2B_V4.md` is a **proposed target model**, not a description of the existing staging schema. Do not create duplicate tables with different names. Reconcile current `organizations/cycles/responses` to the intended `tenants/pulse_weeks/pulse_responses` design before migrations.

Existing `responses` contain a `submitted_at` timestamp; inspect timing-linkage risk with `invitations.redeemed_at` before any real employee data. Do not promise anonymity solely from missing foreign keys.

## Next verification gates

1. Review function privileges, exposed schemas, RLS policy behavior under two real authenticated test identities, and cross-organization negative tests.
2. Decide whether to use the current 4 question rows as demo fixtures or populate the full versioned 30-item library in staging.
3. Implement secure invitation redemption and aggregation through controlled server functions; do not expose `invitations` or `responses` directly.
4. Implement idempotent Monday/Wednesday/Friday jobs with sandbox notifications and logs.
5. Validate privacy, retention, anti-differencing and role access before enabling a real-company pilot.

No production deployment or employee outreach is authorized by this document.
