-- REVIEW ONLY. Explicit staging approval required. Not an applied migration.
-- Successful calls consume a shared per-user minute bucket. Failed transactions roll back.
-- Upstream ingress protection and retention remain separate requirements.
BEGIN;
CREATE TABLE aurea_manager_rpc.request_limits (
 user_id uuid NOT NULL,
 window_start timestamptz NOT NULL,
 hits integer NOT NULL CHECK(hits BETWEEN 1 AND 120),
 PRIMARY KEY(user_id,window_start)
);
ALTER TABLE aurea_manager_rpc.request_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON aurea_manager_rpc.request_limits FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION aurea_manager_rpc.check_session_and_limit()
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' AS $guard$
DECLARE u uuid := auth.uid(); w timestamptz; h integer;
BEGIN
 IF u IS NULL OR NOT EXISTS (
 SELECT 1 FROM auth.sessions s JOIN auth.users a ON a.id=s.user_id
 WHERE s.user_id=u AND s.id::text=auth.jwt()->>'session_id'
 AND a.deleted_at IS NULL AND (a.banned_until IS NULL OR a.banned_until<=clock_timestamp())
 AND (s.not_after IS NULL OR s.not_after>clock_timestamp())
 ) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 w:=to_timestamp(floor(extract(epoch FROM clock_timestamp())/60)*60);
 INSERT INTO aurea_manager_rpc.request_limits AS l(user_id,window_start,hits)
 VALUES(u,w,1) ON CONFLICT(user_id,window_start) DO UPDATE SET hits=l.hits+1 WHERE l.hits<120 RETURNING hits INTO h;
 IF h IS NULL THEN RAISE EXCEPTION 'Request limit reached' USING ERRCODE='P0001'; END IF;
END $guard$;
REVOKE ALL ON FUNCTION aurea_manager_rpc.check_session_and_limit() FROM PUBLIC,anon,authenticated,service_role;

DO $verify$ BEGIN IF pg_get_functiondef('aurea_manager_rpc.aurea_manager_actions(uuid)'::regprocedure) IS DISTINCT FROM $original$CREATE OR REPLACE FUNCTION aurea_manager_rpc.aurea_manager_actions(p_organization_id uuid)
 RETURNS TABLE(id uuid, cycle_id uuid, description text, due_on date, status text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if (select auth.uid()) is null or not exists(select 1 from aurea_private.memberships m where m.user_id=(select auth.uid()) and m.organization_id=p_organization_id and m.role in ('owner','manager')) then raise exception 'Access denied' using errcode='42501';end if;
 return query select a.id,a.cycle_id,a.description,a.due_on,a.status,a.created_at from aurea_private.manager_actions a where a.organization_id=p_organization_id order by a.created_at desc limit 100;
end $function$
$original$ THEN RAISE EXCEPTION 'Manager definition drift: aurea_manager_actions'; END IF; END $verify$;
CREATE OR REPLACE FUNCTION aurea_manager_rpc.aurea_manager_actions(p_organization_id uuid)
 RETURNS TABLE(id uuid, cycle_id uuid, description text, due_on date, status text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 VOLATILE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 perform aurea_manager_rpc.check_session_and_limit();
 if (select auth.uid()) is null or not exists(select 1 from aurea_private.memberships m where m.user_id=(select auth.uid()) and m.organization_id=p_organization_id and m.role in ('owner','manager')) then raise exception 'Access denied' using errcode='42501';end if;
 return query select a.id,a.cycle_id,a.description,a.due_on,a.status,a.created_at from aurea_private.manager_actions a where a.organization_id=p_organization_id order by a.created_at desc limit 100;
end $function$;

DO $verify$ BEGIN IF pg_get_functiondef('aurea_manager_rpc.aurea_manager_cycles(uuid)'::regprocedure) IS DISTINCT FROM $original$CREATE OR REPLACE FUNCTION aurea_manager_rpc.aurea_manager_cycles(p_organization_id uuid)
 RETURNS TABLE(cycle_id uuid, week_start date, state text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if (select auth.uid()) is null or not exists(select 1 from aurea_private.memberships m where m.user_id=(select auth.uid()) and m.organization_id=p_organization_id and m.role in ('owner','manager')) then raise exception 'Access denied' using errcode='42501';end if;
 return query select c.id,c.week_start,c.state from aurea_private.cycles c where c.organization_id=p_organization_id and c.state='closed' order by c.week_start desc limit 52;
end $function$
$original$ THEN RAISE EXCEPTION 'Manager definition drift: aurea_manager_cycles'; END IF; END $verify$;
CREATE OR REPLACE FUNCTION aurea_manager_rpc.aurea_manager_cycles(p_organization_id uuid)
 RETURNS TABLE(cycle_id uuid, week_start date, state text)
 LANGUAGE plpgsql
 VOLATILE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 perform aurea_manager_rpc.check_session_and_limit();
 if (select auth.uid()) is null or not exists(select 1 from aurea_private.memberships m where m.user_id=(select auth.uid()) and m.organization_id=p_organization_id and m.role in ('owner','manager')) then raise exception 'Access denied' using errcode='42501';end if;
 return query select c.id,c.week_start,c.state from aurea_private.cycles c where c.organization_id=p_organization_id and c.state='closed' order by c.week_start desc limit 52;
end $function$;

DO $verify$ BEGIN IF pg_get_functiondef('aurea_manager_rpc.aurea_manager_save_action(uuid,text,date,uuid,uuid,text)'::regprocedure) IS DISTINCT FROM $original$CREATE OR REPLACE FUNCTION aurea_manager_rpc.aurea_manager_save_action(p_organization_id uuid, p_description text, p_due_on date DEFAULT NULL::date, p_cycle_id uuid DEFAULT NULL::uuid, p_action_id uuid DEFAULT NULL::uuid, p_status text DEFAULT 'open'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result uuid;
begin
 if (select auth.uid()) is null or not exists(select 1 from aurea_private.memberships m where m.user_id=(select auth.uid()) and m.organization_id=p_organization_id and m.role in ('owner','manager')) then raise exception 'Access denied' using errcode='42501';end if;
 if length(trim(coalesce(p_description,''))) not between 3 and 2000 or p_status is null or p_status not in ('open','done') then raise exception 'Invalid action';end if;
 if p_cycle_id is not null and not exists(select 1 from aurea_private.cycles c where c.id=p_cycle_id and c.organization_id=p_organization_id) then raise exception 'Invalid cycle';end if;
 if p_action_id is null then
 insert into aurea_private.manager_actions(organization_id,cycle_id,created_by,description,due_on,status)
 values(p_organization_id,p_cycle_id,(select auth.uid()),trim(p_description),p_due_on,p_status) returning id into result;
 else
 update aurea_private.manager_actions a set description=trim(p_description),due_on=p_due_on,status=p_status,updated_at=now()
 where a.id=p_action_id and a.organization_id=p_organization_id returning a.id into result;
 if result is null then raise exception 'Action not found';end if;
 end if;
 return result;
end $function$
$original$ THEN RAISE EXCEPTION 'Manager definition drift: aurea_manager_save_action'; END IF; END $verify$;
CREATE OR REPLACE FUNCTION aurea_manager_rpc.aurea_manager_save_action(p_organization_id uuid, p_description text, p_due_on date DEFAULT NULL::date, p_cycle_id uuid DEFAULT NULL::uuid, p_action_id uuid DEFAULT NULL::uuid, p_status text DEFAULT 'open'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result uuid;
begin
 perform aurea_manager_rpc.check_session_and_limit();
 if (select auth.uid()) is null or not exists(select 1 from aurea_private.memberships m where m.user_id=(select auth.uid()) and m.organization_id=p_organization_id and m.role in ('owner','manager')) then raise exception 'Access denied' using errcode='42501';end if;
 if length(trim(coalesce(p_description,''))) not between 3 and 2000 or p_status is null or p_status not in ('open','done') then raise exception 'Invalid action';end if;
 if p_cycle_id is not null and not exists(select 1 from aurea_private.cycles c where c.id=p_cycle_id and c.organization_id=p_organization_id) then raise exception 'Invalid cycle';end if;
 if p_action_id is null then
 insert into aurea_private.manager_actions(organization_id,cycle_id,created_by,description,due_on,status)
 values(p_organization_id,p_cycle_id,(select auth.uid()),trim(p_description),p_due_on,p_status) returning id into result;
 else
 update aurea_private.manager_actions a set description=trim(p_description),due_on=p_due_on,status=p_status,updated_at=now()
 where a.id=p_action_id and a.organization_id=p_organization_id returning a.id into result;
 if result is null then raise exception 'Action not found';end if;
 end if;
 return result;
end $function$;

DO $verify$ BEGIN IF pg_get_functiondef('aurea_manager_rpc.aurea_manager_summary(uuid)'::regprocedure) IS DISTINCT FROM $original$CREATE OR REPLACE FUNCTION aurea_manager_rpc.aurea_manager_summary(p_organization_id uuid)
 RETURNS TABLE(week_start date, question_code text, domain text, response_count bigint, favorable_percent numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if not exists(select 1 from aurea_private.memberships m where m.organization_id=p_organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','manager')) then
 raise exception 'Access denied' using errcode='42501';
 end if;
 return query select s.week_start,s.question_code,s.domain,s.response_count,s.favorable_percent from aurea_private.pulse_summary(p_organization_id,5) s;
end $function$
$original$ THEN RAISE EXCEPTION 'Manager definition drift: aurea_manager_summary'; END IF; END $verify$;
CREATE OR REPLACE FUNCTION aurea_manager_rpc.aurea_manager_summary(p_organization_id uuid)
 RETURNS TABLE(week_start date, question_code text, domain text, response_count bigint, favorable_percent numeric)
 LANGUAGE plpgsql
 VOLATILE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 perform aurea_manager_rpc.check_session_and_limit();
 if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if not exists(select 1 from aurea_private.memberships m where m.organization_id=p_organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','manager')) then
 raise exception 'Access denied' using errcode='42501';
 end if;
 return query select s.week_start,s.question_code,s.domain,s.response_count,s.favorable_percent from aurea_private.pulse_summary(p_organization_id,5) s;
end $function$;

DO $verify$ BEGIN IF pg_get_functiondef('aurea_manager_rpc.aurea_my_companies()'::regprocedure) IS DISTINCT FROM $original$CREATE OR REPLACE FUNCTION aurea_manager_rpc.aurea_my_companies()
 RETURNS TABLE(organization_id uuid, organization_name text, member_role text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='28000'; end if;
 return query
 select o.id,o.name,m.role
 from aurea_private.memberships m
 join aurea_private.organizations o on o.id=m.organization_id
 where m.user_id=(select auth.uid()) and m.role in ('owner','manager')
 order by o.name;
end $function$
$original$ THEN RAISE EXCEPTION 'Manager definition drift: aurea_my_companies'; END IF; END $verify$;
CREATE OR REPLACE FUNCTION aurea_manager_rpc.aurea_my_companies()
 RETURNS TABLE(organization_id uuid, organization_name text, member_role text)
 LANGUAGE plpgsql
 VOLATILE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 perform aurea_manager_rpc.check_session_and_limit();
 if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='28000'; end if;
 return query
 select o.id,o.name,m.role
 from aurea_private.memberships m
 join aurea_private.organizations o on o.id=m.organization_id
 where m.user_id=(select auth.uid()) and m.role in ('owner','manager')
 order by o.name;
end $function$;

DO $verify$ BEGIN IF pg_get_functiondef('aurea_private.manager_publications_v2(uuid)'::regprocedure) IS DISTINCT FROM $original$CREATE OR REPLACE FUNCTION aurea_private.manager_publications_v2(p_org uuid)
 RETURNS TABLE(week_start date, item_code text, item_version integer, domain text, response_count bigint, favorable_percent numeric, closed boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
if auth.uid() is null or not exists(select 1 from aurea_private.memberships m where m.organization_id=p_org and m.user_id=auth.uid() and m.role in ('owner','manager')) then raise exception 'Access denied' using errcode='42501'; end if;
return query select c.week_start,q.code,q.item_version,q.domain,count(a.rating),round(100.0*count(*) filter(where a.rating>=4)/nullif(count(a.rating),0),1),true
from aurea_private.cycles c join aurea_private.responses r on r.cycle_id=c.id join aurea_private.response_answers a on a.response_id=r.id join aurea_private.questions q on q.id=a.question_id join aurea_private.cycle_questions cq on cq.cycle_id=c.id and cq.question_id=q.id
where c.organization_id=p_org and c.state='closed' and c.model_version=2 and q.model_version=2
group by c.week_start,q.code,q.item_version,q.domain having count(a.rating)>=5 order by c.week_start,q.code;
end $function$
$original$ THEN RAISE EXCEPTION 'Manager definition drift: manager_publications_v2'; END IF; END $verify$;
CREATE OR REPLACE FUNCTION aurea_private.manager_publications_v2(p_org uuid)
 RETURNS TABLE(week_start date, item_code text, item_version integer, domain text, response_count bigint, favorable_percent numeric, closed boolean)
 LANGUAGE plpgsql
 VOLATILE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 perform aurea_manager_rpc.check_session_and_limit();
if auth.uid() is null or not exists(select 1 from aurea_private.memberships m where m.organization_id=p_org and m.user_id=auth.uid() and m.role in ('owner','manager')) then raise exception 'Access denied' using errcode='42501'; end if;
return query select c.week_start,q.code,q.item_version,q.domain,count(a.rating),round(100.0*count(*) filter(where a.rating>=4)/nullif(count(a.rating),0),1),true
from aurea_private.cycles c join aurea_private.responses r on r.cycle_id=c.id join aurea_private.response_answers a on a.response_id=r.id join aurea_private.questions q on q.id=a.question_id join aurea_private.cycle_questions cq on cq.cycle_id=c.id and cq.question_id=q.id
where c.organization_id=p_org and c.state='closed' and c.model_version=2 and q.model_version=2
group by c.week_start,q.code,q.item_version,q.domain having count(a.rating)>=5 order by c.week_start,q.code;
end $function$;
ALTER FUNCTION public.aurea_my_companies() VOLATILE;
ALTER FUNCTION public.aurea_manager_actions(uuid) VOLATILE;
ALTER FUNCTION public.aurea_manager_cycles(uuid) VOLATILE;
ALTER FUNCTION public.aurea_manager_summary(uuid) VOLATILE;
ALTER FUNCTION public.aurea_manager_publications_v2(uuid) VOLATILE;
-- Before approval, verify ownership, exact grants, POST-only clients, cleanup and HTTP semantics.
COMMIT;
