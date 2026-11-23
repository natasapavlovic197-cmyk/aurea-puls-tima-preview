# Supabase staging — durable limiter table installed (2026-11-23)

Project: `ublzmoroanhlcgpnxilw`. The table `aurea_private.api_rate_limits` was created in the staging database with:
- HMAC SHA-256 bucket key format check (64 hex chars)
- timestamped window, positive hit count, composite primary key
- RLS enabled
- revoked all privileges from PUBLIC, anon and authenticated

Read-back SQL confirmed `relrowsecurity = true`, `anon_select = false`, `auth_select = false`. No live employee data or invitations were processed.

**Important:** This is only the storage layer. The `architecture/postgres-durable-limiter.cjs` module is not connected to an actual database connection yet; it requires a restricted server role and durable connection/secret configuration. No direct grants to public roles. The Netlify endpoints remain disabled.

Next: choose/provision restricted server DB role, grant minimum required permissions and RLS policy or a reviewed private server-only function; configure secrets only in Netlify environment; verify atomic upsert with a rollback-safe staging test, then enable controlled test endpoint. Confirm existing schema and any owner/bypass-RLS implications before granting.

Do not touch the production AUREA site or locked designs.
