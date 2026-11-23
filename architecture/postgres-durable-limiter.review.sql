-- REVIEW-ONLY, NOT APPLIED. Install only after approving dedicated
-- restricted server DB role and connection configuration.
-- Private durable rate-limit counters; no raw client IPs or invitation tokens.
create table if not exists aurea_private.api_rate_limits (
 bucket_key text not null check (bucket_key ~ '^[0-9a-f]{64}$'),
 window_start timestamptz not null,
 hits bigint not null check (hits >= 1),
 primary key (bucket_key,window_start)
);
alter table aurea_private.api_rate_limits enable row level security;
revoke all on aurea_private.api_rate_limits from public,anon,authenticated;
-- Do not grant this table to public browser roles.
-- Grant only INSERT, UPDATE, SELECT to the restricted server role.
-- Add periodic cleanup of expired windows after the retention period is approved.
