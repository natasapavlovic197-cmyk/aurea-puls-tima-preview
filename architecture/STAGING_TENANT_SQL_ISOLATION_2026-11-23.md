# Live staging manager isolation check — 2026-11-23

**Supabase project:** `ublzmoroanhlcgpnxilw`

Read-only inventory before test: 1 organization, 1 membership, 1 auth user, 0 limiter rows. Existing memberships enforce FK to auth.users and owner/manager role constraint.

Executed transaction-scoped staging test against actual `public.aurea_manager_summary` SQL function:
1. Set `request.jwt.claim.sub` locally to the existing staging membership user UUID, call own organization's summary: **allowed**.
2. Insert a temporary second organization with no membership, call its summary as the same user: **denied** with insufficient_privilege.
3. Clear JWT claim, call own organization: **denied** with invalid_authorization_specification.
4. `ROLLBACK` removed temporary organization and all test state.

All three result flags returned true. The test used a privileged SQL session with **simulated auth.uid() claim**, not two actual signed-in users or an external HTTP JWT; thus it validates SQL authorization checks only, not end-to-end identity verification. It did not read or expose individual responses.

Remaining release blockers: second actual staging Auth user and membership with separate organization; authenticated HTTP RPC tests for both tenants; secure Netlify secret configuration; restricted runtime database connection and durable rate-limit enforcement; end-to-end employee token flow; locked UI integration. All public employee endpoints remain disabled.
