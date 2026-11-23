# AUREA staging — actual connection handoff (not yet live)

Status: GitHub unit/integration simulations pass. Netlify manager function is gated off. No production change.

## Hard blocker
The existing PostgreSQL role `aurea_rate_limiter` is **NOLOGIN**. It cannot authenticate with a password, even if a Netlify secret is set. Do **not** use the `postgres`, `service_role`, `anon` or `authenticated` identities as substitutes.

The current runtime additionally insists that `current_user = 'aurea_rate_limiter'` and `rolbypassrls = false`. Before deployment, a database administrator must choose and verify a secure restricted login strategy that satisfies these checks. This is an explicit provisioning task, not solved by JavaScript.

## Remaining tasks in order
1. Provision a limited PostgreSQL login with only the atomic rate-limit counter permissions. Confirm RLS and the actual SQL `current_user` over a real TLS connection. Do not place any password in GitHub or this document.
2. Install and pin the `pg` runtime dependency with a committed npm lockfile. Confirm Netlify bundles `pg` for `netlify/functions/aurea-manager-summary.cjs`.
3. Configure Netlify **server-only** environment variables: `AUREA_STAGING_DATABASE_HOST`, `AUREA_STAGING_DATABASE_NAME`, `AUREA_STAGING_DATABASE_USER`, `AUREA_STAGING_DATABASE_PASSWORD`, `AUREA_LIMITER_SECRET`, `AUREA_SUPABASE_URL`, `AUREA_SUPABASE_PUBLISHABLE_KEY`. Verify TLS trust for the actual Supabase database/pooler endpoint.
4. Keep `AUREA_B2B_MANAGER_ENABLED` and `AUREA_B2B_MANAGER_DEPLOY_APPROVED` unset until all prior checks pass. Then activate on **preview only** and test valid JWT, invalid JWT, foreign tenant, low-response suppression, DB failure, and 21st request.
5. Confirm no service-role secrets or employee responses are included in browser bundles or logs. Only then consider production release.

## Scope
The public website, locked manager/employee design and employee endpoint remain unchanged. These steps do **not** activate email automation, manager login UI, or live pulse invitations.
