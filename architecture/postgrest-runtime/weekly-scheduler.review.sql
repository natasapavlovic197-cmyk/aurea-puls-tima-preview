-- Review only. No cron installation, no email, no automatic activation.
BEGIN;
CREATE FUNCTION aurea_delivery_rpc.schedule_due() RETURNS TABLE(action text, queued integer, not_ready integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE local_now timestamp:=clock_timestamp() AT TIME ZONE 'Europe/Belgrade';
 w date:=date_trunc('week',local_now)::date;
 a text; n integer; missing integer;
BEGIN
 PERFORM aurea_delivery_rpc.authorize();
 a:=CASE extract(isodow from local_now) WHEN 1 THEN 'invite' WHEN 3 THEN 'reminder' WHEN 5 THEN 'report' ELSE NULL END;
 IF a IS NULL OR extract(hour from local_now)<9 THEN RETURN; END IF;
 -- Only explicitly scoped tenants with a prepared cycle. Never close a cycle implicitly.
 INSERT INTO aurea_private.weekly_delivery_jobs(organization_id,week_start,action)
 SELECT c.organization_id,w,a FROM aurea_private.cycles c
 WHERE c.week_start=w AND c.model_version=2 AND aurea_delivery_rpc.allowed_org(c.organization_id)
 AND ((a='report' AND c.state='closed') OR (a IN ('invite','reminder') AND c.state='open'))
 ON CONFLICT (organization_id,week_start,action) DO NOTHING;
 GET DIAGNOSTICS n=ROW_COUNT;
 SELECT count(*)::integer INTO missing FROM aurea_delivery_rpc.scopes s
 WHERE s.user_id=auth.uid() AND NOT EXISTS(SELECT 1 FROM aurea_private.cycles c WHERE c.organization_id=s.organization_id AND c.week_start=w AND c.model_version=2 AND ((a='report' AND c.state='closed') OR (a IN ('invite','reminder') AND c.state='open')));
 RETURN QUERY SELECT a,n,missing;
END $$;
REVOKE ALL ON FUNCTION aurea_delivery_rpc.schedule_due() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.aurea_delivery_schedule_due() RETURNS TABLE(action text,queued integer,not_ready integer)
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM aurea_delivery_rpc.schedule_due() $$;
REVOKE ALL ON FUNCTION public.aurea_delivery_schedule_due() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.aurea_delivery_schedule_due(),aurea_delivery_rpc.schedule_due() TO authenticated;
COMMIT;
