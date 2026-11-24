-- REVIEW ONLY. Do not apply to staging or production without explicit approval.
-- No historical backfill. Existing delivered reports cannot be recalled.
BEGIN;
CREATE FUNCTION aurea_private.privacy_publishable_v1(n bigint,f bigint,invited bigint)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce(n>=5 AND n<=invited AND f>=2 AND n-f>=2,false)
$$;
REVOKE ALL ON FUNCTION aurea_private.privacy_publishable_v1(bigint,bigint,bigint) FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE aurea_private.privacy_cycle_seals_v1(
 cycle_id uuid PRIMARY KEY REFERENCES aurea_private.cycles(id),
 organization_id uuid NOT NULL, week_start date NOT NULL,
 UNIQUE(organization_id,week_start)
);
CREATE TABLE aurea_private.privacy_publications_v1(
 cycle_id uuid NOT NULL REFERENCES aurea_private.privacy_cycle_seals_v1(cycle_id),
 item_code text NOT NULL,item_version integer NOT NULL,domain text NOT NULL,
 response_count bigint NOT NULL CHECK(response_count>=5),
 favorable_percent numeric NOT NULL CHECK(favorable_percent BETWEEN 0 AND 100),
 PRIMARY KEY(cycle_id,item_code,item_version)
);
ALTER TABLE aurea_private.privacy_cycle_seals_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE aurea_private.privacy_publications_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE aurea_private.privacy_cycle_seals_v1,aurea_private.privacy_publications_v1 FROM PUBLIC,anon,authenticated,service_role;
-- Invoker trigger: existing authorized cycle-close owner must have write privileges.
-- One seal per organization/week, even if zero publishable rows; never recalculate.
CREATE FUNCTION aurea_private.seal_privacy_cycle_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NEW.state<>'closed' OR NEW.model_version<>2 THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN IF OLD.state='closed' THEN RETURN NEW; END IF; END IF;
 INSERT INTO aurea_private.privacy_cycle_seals_v1(cycle_id,organization_id,week_start)
 VALUES(NEW.id,NEW.organization_id,NEW.week_start) ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN RETURN NEW; END IF;
 INSERT INTO aurea_private.privacy_publications_v1
 SELECT NEW.id,q.code,q.item_version,q.domain,count(a.rating),
 round(100.0*count(*) FILTER(WHERE a.rating BETWEEN 4 AND 5)/nullif(count(a.rating),0),1)
 FROM aurea_private.responses r JOIN aurea_private.response_answers a ON a.response_id=r.id
 JOIN aurea_private.questions q ON q.id=a.question_id
 JOIN aurea_private.cycle_questions cq ON cq.cycle_id=NEW.id AND cq.question_id=q.id
 WHERE r.cycle_id=NEW.id AND q.model_version=2 AND a.rating BETWEEN 1 AND 5 AND NOT a.not_applicable
 GROUP BY q.code,q.item_version,q.domain
 HAVING aurea_private.privacy_publishable_v1(count(a.rating),count(*) FILTER(WHERE a.rating BETWEEN 4 AND 5),
 (SELECT count(*) FROM aurea_private.invitations i WHERE i.cycle_id=NEW.id));
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION aurea_private.seal_privacy_cycle_v1() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER privacy_seal_on_close_v1 AFTER INSERT OR UPDATE OF state ON aurea_private.cycles
 FOR EACH ROW EXECUTE FUNCTION aurea_private.seal_privacy_cycle_v1();

CREATE OR REPLACE FUNCTION aurea_delivery_rpc.impl_delivery_publications(p_job bigint, p_lease uuid, p_org uuid, p_week date)
 RETURNS TABLE(week_start text, item_code text, item_version integer, domain text, response_count integer, favorable_percent double precision, closed boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 perform aurea_delivery_rpc.require_job(p_job,p_lease); perform aurea_delivery_rpc.require_org(p_org);
 if not exists(select 1 from aurea_private.weekly_delivery_jobs j join aurea_private.cycles c on c.organization_id=j.organization_id and c.week_start=j.week_start where j.id=p_job and j.lease_token=p_lease and j.status='processing' and j.lease_expires_at>clock_timestamp() and j.organization_id=p_org and j.week_start=p_week and j.action='report' and c.state='closed') then raise exception 'Invalid report scope'; end if;
 RETURN QUERY SELECT s.week_start::text,p.item_code,p.item_version,p.domain,p.response_count::integer,p.favorable_percent::double precision,true FROM aurea_private.privacy_cycle_seals_v1 s JOIN aurea_private.privacy_publications_v1 p ON p.cycle_id=s.cycle_id WHERE s.organization_id=p_org AND s.week_start<=p_week ORDER BY s.week_start,p.item_code;
end $function$;

CREATE OR REPLACE FUNCTION aurea_delivery_rpc.impl_persist_weekly_digest(p_job bigint, p_lease uuid, p_digest jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare j aurea_private.weekly_delivery_jobs%rowtype; saved jsonb;
begin
 perform aurea_delivery_rpc.require_job(p_job,p_lease);
select * into j from aurea_private.weekly_delivery_jobs where id=p_job and action='report' and status='processing' and lease_token=p_lease and lease_expires_at>clock_timestamp() for update;
if not found then return false; end if;
if not exists(select 1 from aurea_private.cycles c where c.organization_id=j.organization_id and c.week_start=j.week_start and c.state='closed') then return false; end if;
if jsonb_typeof(p_digest) is distinct from 'object' or p_digest->>'weekStart' is distinct from j.week_start::text or jsonb_typeof(p_digest->'domains') is distinct from 'array' then return false; end if;
if exists(select 1 from jsonb_object_keys(p_digest) k where k not in ('weekStart','coverage','domains','nextAction','note')) then return false; end if;
if jsonb_typeof(p_digest->'coverage') is distinct from 'number' or p_digest->>'coverage' is distinct from jsonb_array_length(p_digest->'domains')::text then return false; end if;
-- Every published item must match a current, closed, model-v2 aggregate of at least five.
if exists(select 1 from jsonb_array_elements(p_digest->'domains') d where jsonb_typeof(d) is distinct from 'object' or jsonb_typeof(d->'items') is distinct from 'array' or exists(select 1 from jsonb_object_keys(d) k where k not in ('label','items'))) then return false; end if;
if exists(select 1 from jsonb_array_elements(p_digest->'domains') d cross join lateral jsonb_array_elements(d->'items') i where jsonb_typeof(i) is distinct from 'object' or exists(select 1 from jsonb_object_keys(i) k where k not in ('code','favorablePercent')) or not exists(SELECT 1 FROM aurea_private.privacy_cycle_seals_v1 s JOIN aurea_private.privacy_publications_v1 p ON p.cycle_id=s.cycle_id WHERE s.organization_id=j.organization_id AND s.week_start=j.week_start AND p.item_code=i->>'code' AND to_jsonb(p.favorable_percent)=i->'favorablePercent')) then return false; end if;
insert into aurea_private.weekly_report_digests(organization_id,week_start,digest) values(j.organization_id,j.week_start,p_digest) on conflict(organization_id,week_start) do nothing;
select digest into saved from aurea_private.weekly_report_digests where organization_id=j.organization_id and week_start=j.week_start;
return saved=p_digest;
end $function$;

CREATE OR REPLACE FUNCTION aurea_private.delivery_publications(p_job bigint, p_lease uuid, p_org uuid, p_week date)
 RETURNS TABLE(week_start text, item_code text, item_version integer, domain text, response_count integer, favorable_percent double precision, closed boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if session_user not in ('aurea_delivery_login','postgres') then raise exception 'Delivery access denied' using errcode='42501'; end if;
 if not exists(select 1 from aurea_private.weekly_delivery_jobs j join aurea_private.cycles c on c.organization_id=j.organization_id and c.week_start=j.week_start where j.id=p_job and j.lease_token=p_lease and j.status='processing' and j.lease_expires_at>clock_timestamp() and j.organization_id=p_org and j.week_start=p_week and j.action='report' and c.state='closed') then raise exception 'Invalid report scope'; end if;
 RETURN QUERY SELECT s.week_start::text,p.item_code,p.item_version,p.domain,p.response_count::integer,p.favorable_percent::double precision,true FROM aurea_private.privacy_cycle_seals_v1 s JOIN aurea_private.privacy_publications_v1 p ON p.cycle_id=s.cycle_id WHERE s.organization_id=p_org AND s.week_start<=p_week ORDER BY s.week_start,p.item_code;
end $function$;

CREATE OR REPLACE FUNCTION aurea_private.manager_publications_v2(p_org uuid)
 RETURNS TABLE(week_start date, item_code text, item_version integer, domain text, response_count bigint, favorable_percent numeric, closed boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 perform aurea_manager_rpc.check_session_and_limit();
if auth.uid() is null or not exists(select 1 from aurea_private.memberships m where m.organization_id=p_org and m.user_id=auth.uid() and m.role in ('owner','manager')) then raise exception 'Access denied' using errcode='42501'; end if;
RETURN QUERY SELECT s.week_start,p.item_code,p.item_version,p.domain,p.response_count,p.favorable_percent,true FROM aurea_private.privacy_cycle_seals_v1 s JOIN aurea_private.privacy_publications_v1 p ON p.cycle_id=s.cycle_id WHERE s.organization_id=p_org ORDER BY s.week_start,p.item_code;
end $function$;

CREATE OR REPLACE FUNCTION aurea_private.persist_weekly_digest(p_job bigint, p_lease uuid, p_digest jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare j aurea_private.weekly_delivery_jobs%rowtype; saved jsonb;
begin
 if session_user not in ('aurea_delivery_login','postgres') then raise exception 'Delivery access denied' using errcode='42501'; end if;
select * into j from aurea_private.weekly_delivery_jobs where id=p_job and action='report' and status='processing' and lease_token=p_lease and lease_expires_at>clock_timestamp() for update;
if not found then return false; end if;
if not exists(select 1 from aurea_private.cycles c where c.organization_id=j.organization_id and c.week_start=j.week_start and c.state='closed') then return false; end if;
if jsonb_typeof(p_digest) is distinct from 'object' or p_digest->>'weekStart' is distinct from j.week_start::text or jsonb_typeof(p_digest->'domains') is distinct from 'array' then return false; end if;
if exists(select 1 from jsonb_object_keys(p_digest) k where k not in ('weekStart','coverage','domains','nextAction','note')) then return false; end if;
if jsonb_typeof(p_digest->'coverage') is distinct from 'number' or p_digest->>'coverage' is distinct from jsonb_array_length(p_digest->'domains')::text then return false; end if;
-- Every published item must match a current, closed, model-v2 aggregate of at least five.
if exists(select 1 from jsonb_array_elements(p_digest->'domains') d where jsonb_typeof(d) is distinct from 'object' or jsonb_typeof(d->'items') is distinct from 'array' or exists(select 1 from jsonb_object_keys(d) k where k not in ('label','items'))) then return false; end if;
if exists(select 1 from jsonb_array_elements(p_digest->'domains') d cross join lateral jsonb_array_elements(d->'items') i where jsonb_typeof(i) is distinct from 'object' or exists(select 1 from jsonb_object_keys(i) k where k not in ('code','favorablePercent')) or not exists(SELECT 1 FROM aurea_private.privacy_cycle_seals_v1 s JOIN aurea_private.privacy_publications_v1 p ON p.cycle_id=s.cycle_id WHERE s.organization_id=j.organization_id AND s.week_start=j.week_start AND p.item_code=i->>'code' AND to_jsonb(p.favorable_percent)=i->'favorablePercent')) then return false; end if;
insert into aurea_private.weekly_report_digests(organization_id,week_start,digest) values(j.organization_id,j.week_start,p_digest) on conflict(organization_id,week_start) do nothing;
select digest into saved from aurea_private.weekly_report_digests where organization_id=j.organization_id and week_start=j.week_start;
return saved=p_digest;
end $function$;

CREATE OR REPLACE FUNCTION aurea_private.pulse_summary(p_organization_id uuid, p_min_responses integer DEFAULT 5)
 RETURNS TABLE(week_start date, question_code text, domain text, response_count bigint, favorable_percent numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
SELECT s.week_start,p.item_code,p.domain,p.response_count,p.favorable_percent FROM aurea_private.privacy_cycle_seals_v1 s JOIN aurea_private.privacy_publications_v1 p ON p.cycle_id=s.cycle_id WHERE s.organization_id=p_organization_id AND p.response_count>=greatest(5,coalesce(p_min_responses,5)) ORDER BY s.week_start,p.item_code
$function$;

COMMIT;
