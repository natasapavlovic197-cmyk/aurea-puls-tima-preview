-- REVIEW ONLY. Use only after confirming exact applied revision and quiescing traffic.
-- Restores original manager definitions; deliberately keeps private counter data for reconciliation.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE OR REPLACE FUNCTION aurea_manager_rpc.aurea_manager_actions(p_organization_id uuid)
 RETURNS TABLE(id uuid, cycle_id uuid, description text, due_on date, status text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if (select auth.uid()) is null or not exists(select 1 from aurea_private.memberships m where m.user_id=(select auth.uid()) and m.organization_id=p_organization_id and m.role in ('owner','manager')) then raise exception 'Access denied' using errcode='42501';end if;
 return query select a.id,a.cycle_id,a.description,a.due_on,a.status,a.created_at from aurea_private.manager_actions a where a.organization_id=p_organization_id order by a.created_at desc limit 100;
end $function$;

CREATE OR REPLACE FUNCTION aurea_manager_rpc.aurea_manager_cycles(p_organization_id uuid)
 RETURNS TABLE(cycle_id uuid, week_start date, state text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if (select auth.uid()) is null or not exists(select 1 from aurea_private.memberships m where m.user_id=(select auth.uid()) and m.organization_id=p_organization_id and m.role in ('owner','manager')) then raise exception 'Access denied' using errcode='42501';end if;
 return query select c.id,c.week_start,c.state from aurea_private.cycles c where c.organization_id=p_organization_id and c.state='closed' order by c.week_start desc limit 52;
end $function$;

CREATE OR REPLACE FUNCTION aurea_manager_rpc.aurea_manager_save_action(p_organization_id uuid, p_description text, p_due_on date DEFAULT NULL::date, p_cycle_id uuid DEFAULT NULL::uuid, p_action_id uuid DEFAULT NULL::uuid, p_status text DEFAULT 'open'::text)
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
end $function$;

CREATE OR REPLACE FUNCTION aurea_manager_rpc.aurea_manager_summary(p_organization_id uuid)
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
end $function$;

CREATE OR REPLACE FUNCTION aurea_manager_rpc.aurea_my_companies()
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
end $function$;

CREATE OR REPLACE FUNCTION aurea_private.manager_publications_v2(p_org uuid)
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
end $function$;
ALTER FUNCTION public.aurea_my_companies() STABLE;
ALTER FUNCTION public.aurea_manager_actions(uuid) STABLE;
ALTER FUNCTION public.aurea_manager_cycles(uuid) STABLE;
ALTER FUNCTION public.aurea_manager_summary(uuid) STABLE;
ALTER FUNCTION public.aurea_manager_publications_v2(uuid) STABLE;
NOTIFY pgrst,'reload schema';
COMMIT;
