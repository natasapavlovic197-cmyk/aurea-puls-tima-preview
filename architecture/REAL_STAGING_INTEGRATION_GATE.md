# AUREA Puls tima — stvarna staging integracija: provereni nalazi (2026-11-23)

## Provereno direktno u postojećoj Supabase bazi
Project: `ublzmoroanhlcgpnxilw`; schema: `aurea_private`.

- `aurea_private.submit_pulse(p_token text, p_answers jsonb)` **već postoji**. SECURITY DEFINER, SHA-256 token lookup with row lock, expiry and cycle-open check, exactly four unique cycle-question UUIDs and 1–5 ratings, atomic response+answers insert and invitation redemption.
- `aurea_private.pulse_summary(p_organization_id uuid,p_min_responses integer default 5)` **već postoji**. Only closed cycles; minimum 5 responses and minimum 5 answers per question; returns week/question/domain/count/favorable percentage.
- `aurea_private` schema USAGE is **not granted** to anon or authenticated. Neither role has EXECUTE on these functions. Therefore the browser **cannot directly invoke** either RPC. This is currently a safe closed boundary, **not** an end-to-end connected employee flow.
- `pulse_summary` currently has **no explicit membership/organization authorization inside its SQL**. It MUST NOT be exposed to authenticated clients or wrapped by a permissive SECURITY DEFINER function. Keep internal until a vetted authorization layer enforces tenant membership and privacy-safe result limits.
- `submit_pulse` is SECURITY DEFINER. Keep unexposed; invoke only through a rate-limited server endpoint that validates token and input shape, limits abuse, does not log raw tokens or answers, and uses an appropriate restricted server-side database identity.
- Current invitations contain recipient addresses and redemption timestamps; responses have submission timestamps. Do not return or correlate these to managers. Consider temporal aggregation and retention before a real pilot.

## Implementation gate — before connecting public preview
1. Server-only `POST /api/pulse/submit`: accepts invite token + four answers; rate limits and uses a restricted server credential. No service-role key in client, no raw token in logs. Generic error messages.
2. Server-only `GET /api/manager/summary`: verify signed-in manager via Supabase Auth, check membership for requested organization, enforce threshold and anti-differencing, return aggregates only. No direct table access.
3. Isolated synthetic two-company test: own-org access succeeds; cross-org read/write fails; invitation replay and expiry fail; below-threshold reports suppressed.
4. End-to-end staging checks and privacy/security review; then enable sandbox-only Mon/Wed/Fri jobs. Do not send real invitations or publish production.
5. Only after these gates, connect premium UI to the tested endpoints.

**Status:** read-only live schema/function audit complete. No schema changes, credentials, real employee data or production site touched.
