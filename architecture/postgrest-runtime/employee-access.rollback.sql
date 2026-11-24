-- REVIEW ONLY. Roll back the dedicated RPC surface; existing responses and legacy grants unchanged.
-- First disable/unpublish frontend routing and drain ongoing requests. Does not undo legitimate submitted responses.
BEGIN;
REVOKE EXECUTE ON FUNCTION public.aurea_employee_pulse_v2(text,text,jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION aurea_rpc_private.employee_pulse_v2(text,text,jsonb) FROM anon;
DROP FUNCTION public.aurea_employee_pulse_v2(text,text,jsonb);
DROP FUNCTION aurea_rpc_private.employee_pulse_v2(text,text,jsonb);
DROP FUNCTION aurea_rpc_private.employee_limit(text,timestamptz,integer);
DROP TABLE aurea_rpc_private.employee_limits;
REVOKE USAGE ON SCHEMA aurea_rpc_private FROM anon;
DROP SCHEMA aurea_rpc_private;
NOTIFY pgrst,'reload schema';
COMMIT;
