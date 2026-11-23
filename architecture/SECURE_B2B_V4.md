# AUREA Puls tima — V4 secure B2B architecture (design baseline)

Status: **design only; no live accounts, database, invitations or email delivery are enabled**.
The existing premium HTML demo and `kringle/index.html` remain unchanged.

## Core boundaries

- Each company is a tenant, identified by a random UUID. All stored records carry `tenant_id`.
- Membership and role assignments are verified on the server, never inferred from a URL or browser storage.
- Employee invitations are single-use, time-limited opaque tokens; only their hashes are stored.
- Pulse answers are anonymous at the reporting layer. The invitation tracking table **must not store a response ID**. An invitation may record `completed_at`, but no link to an answer.
- Each week's four questions are selected from the 30-item, five-domain library with a versioned, auditable selection policy. Optional free text is **not collected in the production MVP**.
- Manager reports aggregate only; no per-employee rows, raw answers, device identifiers, or token data.
- The demo's synthetic data must remain explicitly marked and completely isolated from real production data.

## Minimal tables (proposed)

- `tenants(id, name, timezone, status, created_at)`
- `memberships(id, tenant_id, user_id, role, status)` — roles: tenant_admin, manager, analyst
- `employees(id, tenant_id, contact_ciphertext, active)` — access limited to invitation service; no manager query
- `pulse_weeks(id, tenant_id, week_start, question_set_version, state)`
- `pulse_invitations(id, tenant_id, pulse_week_id, employee_id, token_hash, expires_at, reminded_at, completed_at)` — strictly no answer FK
- `pulse_responses(id, tenant_id, pulse_week_id, domain, answer_code, submitted_at_bucket)` — no employee_id, invitation_id, IP or free text
- `manager_actions(id, tenant_id, created_by, domain, description, owner_role, due_at, status, created_at, updated_at)`
- `report_snapshots(id, tenant_id, pulse_week_id, aggregate_json, generated_at, report_version)`
- `audit_events(id, tenant_id, actor_id, action_type, occurred_at, metadata_safe)` — never include raw answers or tokens

## Privacy and reporting

- Proposed minimum: report a domain only with **at least 5 distinct respondents**. This is a provisional product threshold, not a guarantee of anonymity; validate for small teams.
- Suppress totals, subgroups and longitudinal deltas when differencing could expose a person (including 5 vs 6 respondents across weeks).
- Avoid demographic filters and individual drill-downs. Avoid exact small response counts when risky.
- Reports can show domain trends only after minimum coverage and anti-differencing checks.
- Managers may see participation bands only if they cannot be combined with team size to infer an individual.
- Require privacy notice, retention schedule, deletion policy, data processing agreement and documented lawful basis before real use.

## Weekly orchestration — Europe/Belgrade

1. Monday: open pulse week, issue one unique invitation per active employee, send via configured provider.
2. Wednesday: send **at most one** discreet reminder only to employees not marked completed, if still inside collection window.
3. Friday: close collection, compute aggregate results and suppression rules, publish concise premium manager report and suggested next action.
4. Later: alerts only on persistent unfavorable **aggregate** trends, minimum sample coverage and open follow-up actions; never alerts about an employee.
5. Jobs must be idempotent with unique (tenant_id, pulse_week_id, job_type) keys, retry/backoff, timezone-aware scheduling and no duplicate emails.

## Required authorization rules

- All tenant-scoped queries enforce `tenant_id` in the database authorization layer, not only the UI.
- An authenticated manager can read only safe aggregates and own-tenant manager actions.
- Invitation endpoints accept token hash lookup, enforce expiry and one-time use, and never reveal membership lists.
- Employee contact lists are inaccessible to managers unless explicitly justified by a separate HR admin permission; never join them to responses.
- Automated test: Tenant A manager cannot read or mutate Tenant B records, including guessed UUIDs.
- Automated test: No path from any stored response to an employee identity via invitation IDs, timestamps or audit logs.

## Implementation gates

**Gate 1** — approve privacy thresholds, retention and tenant schema.
**Gate 2** — create isolated staging backend with row-level security, migrations and test accounts.
**Gate 3** — test cross-tenant access, token expiry/replay, duplicate jobs, reporting suppression and consent/privacy flows.
**Gate 4** — integrate staging UI and transactional email in sandbox mode; verify Monday/Wednesday/Friday sequence.
**Gate 5** — security/privacy review, limited pilot, monitoring and rollback plan; only then production.

Do not connect real employee data to the current public demo.
