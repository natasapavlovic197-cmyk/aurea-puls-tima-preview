ALTER FUNCTION public.aurea_admin_dispatch_v1(text,jsonb) SET SCHEMA aurea_admin;
REVOKE ALL ON FUNCTION aurea_admin.aurea_admin_dispatch_v1(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA aurea_admin TO authenticated;
GRANT EXECUTE ON FUNCTION aurea_admin.aurea_admin_dispatch_v1(text,jsonb) TO authenticated;
CREATE FUNCTION public.aurea_admin_dispatch_v1(p_action text,p_payload jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT aurea_admin.aurea_admin_dispatch_v1(p_action,p_payload) $$;
REVOKE ALL ON FUNCTION public.aurea_admin_dispatch_v1(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.aurea_admin_dispatch_v1(text,jsonb) TO authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA aurea_admin FROM PUBLIC,anon,authenticated,service_role;
