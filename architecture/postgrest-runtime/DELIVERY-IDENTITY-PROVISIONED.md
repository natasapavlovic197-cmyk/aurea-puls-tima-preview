# Staging delivery identity registration — 2026-11-24
Project: ublzmoroanhlcgpnxilw (aurea-puls-staging).
Identity: 3070286d-a61b-43f2-8d2b-d3c0461bf54c.
Candidate address: aurea-delivery-staging@example.invalid.
User created via dashboard Create user / auto confirm, not invitation. No credential values inspected. User explicitly approved allowlist registration.
## Applied operation
A single transaction with lock_timeout 5s and statement_timeout 15s locked memberships, identities and scopes in SHARE ROW EXCLUSIVE mode. Checked exact active confirmed non-anonymous Auth identity, no membership, no existing delivery identities/scopes and no sessions. Inserted exactly one row in aurea_delivery_rpc.identities. Rechecked one target row, no scopes or memberships, then committed. No Auth user modifications, schema or grant changes.
## Independent live readback
total_delivery_identities=1; target_allowlisted=1; total_scopes=0; target_memberships=0; target_sessions=0; rls_tables=2; private_table_access_denied=true (anon, authenticated and service_role table privileges).
No company data access authorized. This is catalog/database verification, not authenticated HTTP verification.
## Compensating rollback (NOT executed)
Keep scheduler and sender disabled. Verify exact identity and zero memberships/scopes. If scopes exist, stop for separate review, because deleting identity cascades scopes. In a transaction lock the three tables as above, assert exact Auth user and exactly one target allowlist row, assert zero scopes and memberships for target, delete only that target row from aurea_delivery_rpc.identities, assert zero remaining target rows, commit. Re-read counts. Do not delete the Auth user, change password, revoke unrelated sessions or modify existing users. Removing the allowlist denies delivery authorization independently of JWT expiry. Session revocation, user deletion, and cleanup of any future environment secrets require separate approval.
## Remaining
Dashboard route supersedes the blocked API Keys metadata probe for creating this user; do not retry HTTP 403 or widen PAT privileges. No password or HMAC provisioned in Netlify by this operation. Credential storage, runtime binding, synthetic HTTP validation, logging audit, rotation/expiry and deployment remain open. No activation or email delivery.
