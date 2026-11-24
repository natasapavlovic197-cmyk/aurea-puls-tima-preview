# AUREA 2D — administrative gate, 2026-11-24
Offline only. Run node architecture/staging-admin-preflight.test.cjs. The module evaluates supplied evidence, not live permissions. Never supply secrets.
1. Confirm exact Session pooler hostname in Supabase Connect panel for ublzmoroanhlcgpnxilw, port 5432, postgres, provider certificate and verify-full TLS. Synthetic fixture hosts are not verified.
2. Confirm Netlify site UUID 91ffeb5a-796e-4b2a-9fde-517c7e42f708. Build status was verified Stopped by TinyFish on 2026-11-24. Keep auto publishing unchanged; recheck before release.
3. Confirm write entitlement, Functions-only scope, exact integration/employee-ten-domains-step5 context, no existing conflicts, no production context.
4. Recheck restricted roles, SET-only membership, NOINHERIT/NOBYPASSRLS and disabled activation flags. Preserve protected environment.
5. Approved provisioning only: independent random DB password and HMAC secret in trusted local administrative session; psql password mechanism over verified TLS, never plaintext SQL or arguments, chat, artifacts or git. Store matching values directly in site-specific Functions-scoped branch secrets. Stop on partial failure, invalidate new login password if necessary, reconcile only newly created variables; no overwrites. Verify metadata without values.
6. Verify actual login identity, SET LOCAL ROLE, rollback-only limiter upsert, denial of other private tables, TLS, pinned pg lockfile and full QA. Deployment requires separate approval.
References: https://supabase.com/docs/guides/database/psql ; https://docs.netlify.com/build/configure-builds/stop-or-activate-builds/ ; https://open-api.netlify.com/ .
