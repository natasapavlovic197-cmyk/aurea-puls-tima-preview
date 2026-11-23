# AUREA Supabase RPC security review — 2026-11-23

**Read-only assessment** of existing staging database `aurea-puls-staging`. No schema, privileges, users or production services changed.

## Verified facts

- Five public `SECURITY DEFINER` RPCs are executable by `authenticated`: `aurea_manager_actions`, `aurea_manager_cycles`, `aurea_manager_save_action`, `aurea_manager_summary`, `aurea_my_companies`.
- All five contain explicit `auth.uid()` checks; the organization-scoped four also check membership and role `owner`/`manager`. The read RPCs scope rows to the requested organization.
- `aurea_manager_save_action` checks organization membership, description length, status and cycle ownership. It updates by both action ID and organization ID.
- `aurea_employee_invitation` and `aurea_employee_submit` have no `anon` or `authenticated` EXECUTE grant at the time of audit. Thus a public employee submission flow is not yet wired.
- `aurea_private` response/invitation tables have RLS enabled without end-user policies; they are not intentionally exposed.
- Supabase security advisor flags five authenticated SECURITY DEFINER functions (WARN), seven no-policy RLS tables (INFO), and leaked-password protection disabled (WARN).
- Existing `responses.submitted_at` and `invitations.redeemed_at` can allow correlation by time, even without an explicit identity foreign key. Must mitigate before real submissions.

## Required next steps

1. Execute **negative and positive authenticated integration tests** using two isolated test accounts belonging to different organizations. Static inspection is insufficient.
2. Inspect `pulse_summary` for minimum sample enforcement and time-differencing leakage. Ensure managers cannot access raw responses.
3. Decide whether each SECURITY DEFINER RPC truly needs elevation. Keep strict authorization and search_path; consider least privilege and move privileged logic to non-exposed schema where possible.
4. Review user password policy and enable leaked-password protection before onboarding.
5. Decide invitation token distribution architecture (server-side token generation, hash-only storage, expiry, replay protection, rate limiting). Do not open existing RPC permissions until tested.
6. Review timestamp bucketing/delayed batch insertion and separation of invite redemption vs response receipt. Preserve idempotency while preventing timestamp correlation.
7. Run security advisor after any changes and record pass/fail outcomes.

Security advisor references:
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

**Assessment:** The RPCs show intentional tenant authorization in their source. This does not prove the isolation works in live authenticated sessions. Do not call the system production ready.
