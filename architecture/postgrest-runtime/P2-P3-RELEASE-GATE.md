# P2 evidence and P3 controlled release gate — 2026-11-24
## Verified evidence
- Run 45417420410, commit 120a23b: six Netlify site-only secret-marked Functions variables for exact integration branch, no activation flags, stopped builds.
- Run 45418558321, commit 8d5f51a: 9/9 dedicated Auth/HTTP isolation checks, zero scoped jobs, manager denied, logout and zero remaining sessions, revoked RPC denied. Do not rerun as a separate gate.
- Supabase unified logs, UTC 14:50:55–14:51:30, aggregate-only query: auth_audit_logs 2, auth_logs 4, edge_logs 6, postgres_logs 2. Zero JWT-shaped matches and zero nonempty sensitive-field matches in serialized log_attributes (password, refresh_token, access_token, authorization, cookie, set-cookie). No raw log records retrieved. This is bounded negative evidence, not exact-secret matching, not a positive-control test, not proof about other fields, retention, external drains or future logs.
- No Netlify runtime log access through current connectors. No deployment or runtime secret verification performed.
## P2 remaining gates
- Employee capability exact-route synthetic positive control and URL/referrer/analytics/browser bundle inspection remain open; no real tokens or employee data.
- Review provider log message fields and external drains if available; preserve audit controls. If a sensitive match is detected, stop, restrict access and rotate affected credentials under separate approval.
- Fix session cleanup when getUser fails after token acquisition; verify targeted new tests. Existing delivery-runtime.test.cjs missing-reader assertion needs updating for intentional default server reader; do not claim old test passes.
- Manager successful-call limiter was verified transactionally, not live concurrent HTTP. Verify authorized synthetic manager and cross-tenant denial before pilot; upstream failed-request capacity remains separate.
## P3 sequence (plan only, no approval inferred)
1. Identify exact build/publish/functions paths, existing live deploy ID, rollback target, branch deploy configuration and protected workflow behavior. Root netlify.toml and package.json unavailable through current file lookup; do not guess layout. Record branch HEAD and manifest; verify no unrelated main or production changes.
2. Targeted tests for changed credential reader/session cleanup and disabled runtime; inspect actual deploy bundle for secrets and private modules. Keep flags absent, zero delivery scopes and no email provider activation.
3. One explicit approval for an isolated branch deploy to the known Netlify staging site, only after exact deploy/rollback procedure verified. No main merge, production alias change or general build re-enable. If provider cannot guarantee isolation, stop.
4. After approved branch deploy, verify exact deploy ID/URL/commit, server-only runtime config using booleans only (never return secret values), no public debug endpoint, no mail or scheduler, manager/employee synthetic smoke, browser leakage controls and provider log checks. No real data. Confirm previous production deploy unchanged.
5. Stop on any failure; disable staged activation, remove only approved temporary diagnostic surface, restore previous known-good deploy only if its restoration was explicitly authorized. Never delete secrets or rotate HMAC blindly; preserve outstanding invitation compatibility.
6. P4 separate approval: one synthetic company then first real pilot with scoped membership, privacy thresholds, retention and contracts, delivery dry-run, explicit send/activation approval. No commercial-readiness claim before gates pass.
## Decision
P2 Auth/provisioning complete; logging evidence partial, P2 overall not fully closed. P3 plan prepared; execution blocked pending exact deployment layout and remaining safety gates. No deployment, schema change, new secret or email in this review.
