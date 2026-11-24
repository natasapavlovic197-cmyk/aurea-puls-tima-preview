-- Review only. No cron installation, no email, no automatic activation.
BEGIN;
CREATE TABLE aurea_delivery_rpc.active_recipients(
 organization_id uuid NOT NULL REFERENCES aurea_private.organizations(id) ON DELETE CASCADE,
 id uuid NOT NULL DEFAULT gen_random_uuid(), email text NOT NULL CHECK(email=lower(btrim(email)) AND length(email)<=254 AND email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
 active boolean NOT NULL DEFAULT true, PRIMARY KEY(organization_id,id), UNIQUE(organization_id,email));
ALTER TABLE aurea_delivery_rpc.active_recipients ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON aurea_delivery_rpc.active_recipients FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION aurea_delivery_rpc.prepare_monday(p_now timestamptz) RETURNS TABLE(organization_id uuid,week_start date,invitation_id uuid,email text,expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE w date:=date_trunc('week',p_now AT TIME ZONE 'Europe/Belgrade')::date; o uuid;
BEGIN
 PERFORM aurea_delivery_rpc.authorize();
 IF extract(isodow from p_now AT TIME ZONE 'Europe/Belgrade')<>1 OR extract(hour from p_now AT TIME ZONE 'Europe/Belgrade')<9 THEN RETURN; END IF;
 FOR o IN SELECT s.organization_id FROM aurea_delivery_rpc.scopes s WHERE s.user_id=auth.uid() ORDER BY s.organization_id LOOP
 PERFORM aurea_private.create_weekly_cycle_v2(o,w);
 END LOOP;
 RETURN QUERY SELECT c.organization_id,w,md5(c.id::text||':'||r.id::text)::uuid,r.email,(w+7)::timestamp AT TIME ZONE 'Europe/Belgrade'
 FROM aurea_private.cycles c JOIN aurea_delivery_rpc.active_recipients r ON r.organization_id=c.organization_id AND r.active
 WHERE c.week_start=w AND c.model_version=2 AND c.state='draft' AND aurea_delivery_rpc.allowed_org(c.organization_id);
END $$;
REVOKE ALL ON FUNCTION aurea_delivery_rpc.prepare_monday(timestamptz) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION aurea_delivery_rpc.prepare_current() RETURNS TABLE(organization_id uuid,week_start date,invitation_id uuid,email text,expires_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT * FROM aurea_delivery_rpc.prepare_monday(clock_timestamp()) $$;
REVOKE ALL ON FUNCTION aurea_delivery_rpc.prepare_current() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.aurea_delivery_prepare_current() RETURNS TABLE(organization_id uuid,week_start date,invitation_id uuid,email text,expires_at timestamptz)
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM aurea_delivery_rpc.prepare_current() $$;
REVOKE ALL ON FUNCTION public.aurea_delivery_prepare_current() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.aurea_delivery_prepare_current(),aurea_delivery_rpc.prepare_current() TO authenticated;

CREATE FUNCTION aurea_delivery_rpc.schedule_at(p_now timestamptz) RETURNS TABLE(action text, queued integer, not_ready integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE local_now timestamp:=p_now AT TIME ZONE 'Europe/Belgrade';
 w date:=date_trunc('week',local_now)::date;
 a text; n integer; missing integer;
BEGIN
 PERFORM aurea_delivery_rpc.authorize();
 a:=CASE extract(isodow from local_now) WHEN 1 THEN 'invite' WHEN 3 THEN 'reminder' WHEN 5 THEN 'report' ELSE NULL END;
 IF a IS NULL OR extract(hour from local_now)<9 THEN RETURN; END IF;
 IF a='invite' THEN
 UPDATE aurea_private.cycles c SET state='open' WHERE c.week_start=w AND c.model_version=2 AND c.state='draft' AND aurea_delivery_rpc.allowed_org(c.organization_id)
 AND EXISTS(SELECT 1 FROM aurea_delivery_rpc.active_recipients r WHERE r.organization_id=c.organization_id AND r.active)
 AND NOT EXISTS(SELECT 1 FROM aurea_delivery_rpc.active_recipients r WHERE r.organization_id=c.organization_id AND r.active AND NOT EXISTS(SELECT 1 FROM aurea_private.invitations i WHERE i.cycle_id=c.id AND i.recipient_address=r.email AND i.id=md5(c.id::text||':'||r.id::text)::uuid));
 ELSIF a='report' THEN
 UPDATE aurea_private.cycles c SET state='closed' WHERE c.week_start=w AND c.model_version=2 AND c.state='open' AND aurea_delivery_rpc.allowed_org(c.organization_id);
 END IF;
 INSERT INTO aurea_private.weekly_delivery_jobs(organization_id,week_start,action)
 SELECT c.organization_id,w,a FROM aurea_private.cycles c
 WHERE c.week_start=w AND c.model_version=2 AND aurea_delivery_rpc.allowed_org(c.organization_id)
 AND ((a='report' AND c.state='closed') OR (a IN ('invite','reminder') AND c.state='open'))
 ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS n=ROW_COUNT;
 SELECT count(*)::integer INTO missing FROM aurea_delivery_rpc.scopes s
 WHERE s.user_id=auth.uid() AND NOT EXISTS(SELECT 1 FROM aurea_private.cycles c WHERE c.organization_id=s.organization_id AND c.week_start=w AND c.model_version=2 AND ((a='report' AND c.state='closed') OR (a IN ('invite','reminder') AND c.state='open')));
 RETURN QUERY SELECT a,n,missing;
END $$;
REVOKE ALL ON FUNCTION aurea_delivery_rpc.schedule_at(timestamptz) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION aurea_delivery_rpc.schedule_due() RETURNS TABLE(action text,queued integer,not_ready integer) LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT * FROM aurea_delivery_rpc.schedule_at(clock_timestamp()) $$;
REVOKE ALL ON FUNCTION aurea_delivery_rpc.schedule_due() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.aurea_delivery_schedule_due() RETURNS TABLE(action text,queued integer,not_ready integer)
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM aurea_delivery_rpc.schedule_due() $$;
REVOKE ALL ON FUNCTION public.aurea_delivery_schedule_due() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.aurea_delivery_schedule_due(),aurea_delivery_rpc.schedule_due() TO authenticated;
COMMIT;
