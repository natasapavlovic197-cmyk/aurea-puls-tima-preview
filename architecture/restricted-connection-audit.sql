-- AUREA staging: READ-ONLY database privilege and RLS gate.
-- Run as an administrator against STAGING ONLY; never embeds passwords or tokens.
-- This script does not create roles, modify data, or grant privileges.

select rolname, rolcanlogin, rolbypassrls, rolinherit
from pg_roles
where rolname like 'aurea_%'
order by rolname;

select c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced,
       has_table_privilege('aurea_rate_limiter', c.oid, 'SELECT') as can_select,
       has_table_privilege('aurea_rate_limiter', c.oid, 'INSERT') as can_insert,
       has_table_privilege('aurea_rate_limiter', c.oid, 'UPDATE') as can_update,
       has_table_privilege('aurea_rate_limiter', c.oid, 'DELETE') as can_delete
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='aurea_private' and c.relkind='r'
order by c.relname;

select schemaname, tablename, policyname, roles, cmd, permissive,
       qual, with_check
from pg_policies
where schemaname='aurea_private' and tablename='api_rate_limits'
order by policyname;

select has_schema_privilege('aurea_rate_limiter','aurea_private','USAGE') as private_schema_usage,
       has_database_privilege('aurea_rate_limiter',current_database(),'CONNECT') as database_connect;

-- PASS criteria (must be evaluated with the application deployment gate):
-- 1. Dedicated LOGIN identity exists, is NOT BYPASSRLS, and is not a privileged role.
-- 2. Limiter identity cannot access organizations, invitations, responses, or actions.
-- 3. RLS on api_rate_limits permits the exact counter upsert for that identity.
-- 4. The actual live SQL session current_user is checked before every counter query.
-- 5. Do not mark this gate passed merely because the GRANT or a mock test passes.
