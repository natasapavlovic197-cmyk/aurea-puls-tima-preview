# Staging database read-only verification — 2026-11-23

Project: `ublzmoroanhlcgpnxilw`. No DDL, DML, live invitations, or real employee input used.

## Confirmed by executing the actual private SQL function
`select * from aurea_private.pulse_summary((select id from aurea_private.organizations limit 1),5)`

| Week | clarity | communication | workload | safety |
|---|---:|---:|---:|---:|
| 2026-11-16 | 83.3% | 33.3% | 0.0% | 83.3% |
| 2026-11-23 | 100.0% | 66.7% | 50.0% | 100.0% |

Each question had six answers. These are existing staging fixture records, not employee observations. The function emits results only for closed cycles and suppresses question rows below its minimum threshold of five.

## Security boundary rechecked
Both `submit_pulse` and `pulse_summary` remain non-executable by `anon` and `authenticated`; `aurea_private` is not a public schema. `submit_pulse` is SECURITY DEFINER; do not expose it through a public wrapper. `pulse_summary` has no internal membership guard and must only be called by a server layer that authorizes the requester and organization.

## Remaining live integration blockers
- Real server-side runtime and restricted database identity, with secrets stored server-side only
- Shared durable rate limiter, including fail-closed behavior
- Supabase Auth verification and tenant-membership check, plus anti-differencing policy
- Two-tenant DB integration fixture and rollback-safe tests; current live DB has one organization only
- Read-only live summary verified, but **no actual invite redemption via a public API** and **no deployed report endpoint** verified

The current premium UI and production AUREA site were not changed.
