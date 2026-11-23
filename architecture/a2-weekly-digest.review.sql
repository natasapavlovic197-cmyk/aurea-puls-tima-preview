create or replace function aurea_private.persist_weekly_digest(p_job bigint,p_lease uuid,p_digest jsonb) returns boolean language plpgsql security invoker set search_path='' as $$
declare j aurea_private.weekly_delivery_jobs%rowtype; saved jsonb;
begin
select * into j from aurea_private.weekly_delivery_jobs where id=p_job and action='report' and status='processing' and lease_token=p_lease and lease_expires_at>clock_timestamp() for update;
if not found then return false; end if;
if not exists(select 1 from aurea_private.cycles c where c.organization_id=j.organization_id and c.week_start=j.week_start and c.state='closed') then return false; end if;
if jsonb_typeof(p_digest) is distinct from 'object' or p_digest->>'weekStart' is distinct from j.week_start::text or jsonb_typeof(p_digest->'domains') is distinct from 'array' then return false; end if;
if exists(select 1 from jsonb_object_keys(p_digest) k where k not in ('weekStart','coverage','domains','nextAction','note')) then return false; end if;
if jsonb_typeof(p_digest->'coverage') is distinct from 'number' or p_digest->>'coverage' is distinct from jsonb_array_length(p_digest->'domains')::text then return false; end if;
-- Every published item must match a current, closed, model-v2 aggregate of at least five.
if exists(select 1 from jsonb_array_elements(p_digest->'domains') d where jsonb_typeof(d) is distinct from 'object' or jsonb_typeof(d->'items') is distinct from 'array' or exists(select 1 from jsonb_object_keys(d) k where k not in ('label','items'))) then return false; end if;
if exists(select 1 from jsonb_array_elements(p_digest->'domains') d cross join lateral jsonb_array_elements(d->'items') i where jsonb_typeof(i) is distinct from 'object' or exists(select 1 from jsonb_object_keys(i) k where k not in ('code','favorablePercent')) or not exists(select 1 from aurea_private.cycles c join aurea_private.responses r on r.cycle_id=c.id join aurea_private.response_answers a on a.response_id=r.id join aurea_private.questions q on q.id=a.question_id join aurea_private.cycle_questions cq on cq.cycle_id=c.id and cq.question_id=q.id where c.organization_id=j.organization_id and c.week_start=j.week_start and c.state='closed' and c.model_version=2 and q.model_version=2 and q.code=i->>'code' group by q.id having count(a.rating)>=5 and to_jsonb(round(100.0*count(*) filter(where a.rating>=4)/nullif(count(a.rating),0),1))=i->'favorablePercent')) then return false; end if;
insert into aurea_private.weekly_report_digests(organization_id,week_start,digest) values(j.organization_id,j.week_start,p_digest) on conflict(organization_id,week_start) do nothing;
select digest into saved from aurea_private.weekly_report_digests where organization_id=j.organization_id and week_start=j.week_start;
return saved=p_digest;
end $$;
revoke all on function aurea_private.persist_weekly_digest(bigint,uuid,jsonb) from public,anon,authenticated,service_role;