# AUREA staging security advisor review — 2026-11-23

Read-only Supabase security advisor run against staging project `ublzmoroanhlcgpnxilw`. **No database or Auth settings changed.**

## Findings
- **WARN: 5 authenticated-executable SECURITY DEFINER RPCs:** `aurea_manager_actions`, `aurea_manager_cycles`, `aurea_manager_save_action`, `aurea_manager_summary`, `aurea_my_companies`. This is an audit warning, **not proof of an exploit**. Reviewed definitions for **all five** functions: each explicitly checks `auth.uid()` and membership (or returns only caller's memberships), and uses `SET search_path TO ''`. The cycles function additionally restricts results to the requested organization and closed cycles (up to 52). This is a static SQL definition review, not a live cross-tenant test. Do not switch to SECURITY INVOKER blindly: private table RLS intentionally has no general manager policies.
  Remediation: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- **INFO: 7 private tables with RLS enabled but no policies:** `cycle_questions`, `cycles`, `invitations`, `organizations`, `questions`, `response_answers`, `responses`. This is consistent with default-deny private-table access but must be checked against the intended server RPC design; do not add blanket permissive policies.
  Remediation: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- **WARN: Supabase Auth leaked-password protection disabled.** Evaluate enabling before accepting real user credentials; do not change Auth settings without explicit approval.
  Remediation: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Release blockers
1. No dedicated restricted SQL LOGIN credential exists yet; existing `aurea_rate_limiter` is NOLOGIN.
2. No verified live manager HTTP/DB integration, multi-tenant isolation, or privacy-threshold regression test.
3. No verified Auth password protection and final security review.
4. Explicit preview deployment approval has not been given.

## Credit discipline
Only read-only SQL/advisor checks and a GitHub documentation commit. No Netlify deploy, no browser wallet, no paid service, no secrets, no DB/Auth changes.
