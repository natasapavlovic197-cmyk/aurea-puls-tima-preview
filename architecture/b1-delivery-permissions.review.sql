-- Narrow private function entry points. Direct table grants deliberately absent.
CREATE OR REPLACE FUNCTION aurea_private.delivery_publications(p_job bigint, p_lease uuid, p_org uuid, p_week date)
 RETURNS TABLE(week_start text, item_code text, item_version integer, domain text, response_count integer, favorable_percent double precision, closed boolean)
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if session_user not in ('aurea_delivery_login','postgres') then raise exception 'Delivery access denied' using errcode='42501'; end if;
 if not exists(select 1 from aurea_private.weekly_delivery_jobs j join aurea_private.cycles c on c.organization_id=j.organization_id and c.week_start=j.week_start where j.id=p_job and j.lease_token=p_lease and j.status='processing' and j.lease_expires_at>clock_timestamp() and j.organization_id=p_org and j.week_start=p_week and j.action='report' and c.state='closed') then raise exception 'Invalid report scope'; end if;
 return query select c.week_start::text,q.code,q.item_version,q.domain,count(a.rating)::integer,round(100.0*count(*) filter(where a.rating>=4)/nullif(count(a.rating),0),1)::double precision,true from aurea_private.cycles c join aurea_private.responses r on r.cycle_id=c.id join aurea_private.response_answers a on a.response_id=r.id join aurea_private.questions q on q.id=a.question_id join aurea_private.cycle_questions cq on cq.cycle_id=c.id and cq.question_id=q.id where c.organization_id=p_org and c.week_start<=p_week and c.state='closed' and c.model_version=2 and q.model_version=2 group by c.week_start,q.code,q.item_version,q.domain having count(a.rating)>=5 order by c.week_start,q.code;
end $function$
;
CREATE OR REPLACE FUNCTION aurea_private.delivery_snapshot(p_job bigint, p_lease uuid, p_org uuid, p_week date, p_action text)
 RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare j aurea_private.weekly_delivery_jobs%rowtype; c aurea_private.cycles%rowtype; recipients jsonb;
begin
 if session_user not in ('aurea_delivery_login','postgres') then raise exception 'Delivery access denied' using errcode='42501'; end if;
 select * into j from aurea_private.weekly_delivery_jobs where id=p_job and lease_token=p_lease and status='processing' and lease_expires_at>clock_timestamp() and organization_id=p_org and week_start=p_week and action=p_action;
 if not found then raise exception 'Invalid delivery scope'; end if;
 if exists(select 1 from aurea_private.recipient_delivery_receipts where job_id=p_job and state in ('pending','uncertain')) then raise exception 'Reconciliation required'; end if;
 select * into c from aurea_private.cycles where organization_id=p_org and week_start=p_week;
 if not found or (p_action='report' and c.state<>'closed') or (p_action<>'report' and c.state<>'open') then raise exception 'Invalid cycle state'; end if;
 if p_action='report' then
  select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'email',u.email,'role',m.role,'active',true) order by m.user_id),'[]'::jsonb) into recipients from aurea_private.memberships m join auth.users u on u.id=m.user_id where m.organization_id=p_org and m.role in ('owner','manager') and u.email_confirmed_at is not null and u.deleted_at is null and (u.banned_until is null or u.banned_until<=clock_timestamp()) and u.email is not null;
 else
  select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'email',i.recipient_address,'tokenHash',i.token_hash,'expiresAt',i.expires_at,'sentAt',i.sent_at,'reminderAt',i.reminder_at,'redeemedAt',i.redeemed_at) order by i.id),'[]'::jsonb) into recipients from aurea_private.invitations i where i.cycle_id=c.id and i.redeemed_at is null and i.expires_at>clock_timestamp() and ((p_action='invite' and i.sent_at is null) or (p_action='reminder' and i.sent_at is not null and i.reminder_at is null));
 end if;
 return jsonb_build_object('cycleClosed',c.state='closed','recipients',recipients);
end $function$
;
CREATE OR REPLACE FUNCTION aurea_private.finish_recipient_delivery(p_job bigint, p_lease uuid, p_key text, p_provider text, p_confirm boolean)
 RETURNS boolean
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare j aurea_private.weekly_delivery_jobs%rowtype; rid uuid;
begin
 if session_user not in ('aurea_delivery_login','postgres') then raise exception 'Delivery access denied' using errcode='42501'; end if;
select * into j from aurea_private.weekly_delivery_jobs where id=p_job and status='processing' and lease_token=p_lease and lease_expires_at>clock_timestamp() for update;
if not found or p_confirm is null or (p_confirm and (p_provider is null or length(trim(p_provider)) not between 1 and 512)) then return false; end if;
update aurea_private.recipient_delivery_receipts set state=case when p_confirm then 'confirmed' else 'uncertain' end,provider_id=case when p_confirm then p_provider else null end,updated_at=clock_timestamp() where job_id=p_job and idempotency_key=p_key and state='pending' returning recipient_id into rid;
if not found then return false; end if;
if p_confirm and j.action='invite' then update aurea_private.invitations set sent_at=coalesce(sent_at,clock_timestamp()) where id=rid;
elsif p_confirm and j.action='reminder' then update aurea_private.invitations set reminder_at=coalesce(reminder_at,clock_timestamp()) where id=rid; end if;
return true;
end $function$
;
CREATE OR REPLACE FUNCTION aurea_private.persist_weekly_digest(p_job bigint, p_lease uuid, p_digest jsonb)
 RETURNS boolean
 LANGUAGE plpgsql SECURITY DEFINER
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
if exists(select 1 from jsonb_array_elements(p_digest->'domains') d cross join lateral jsonb_array_elements(d->'items') i where jsonb_typeof(i) is distinct from 'object' or exists(select 1 from jsonb_object_keys(i) k where k not in ('code','favorablePercent')) or not exists(select 1 from aurea_private.cycles c join aurea_private.responses r on r.cycle_id=c.id join aurea_private.response_answers a on a.response_id=r.id join aurea_private.questions q on q.id=a.question_id join aurea_private.cycle_questions cq on cq.cycle_id=c.id and cq.question_id=q.id where c.organization_id=j.organization_id and c.week_start=j.week_start and c.state='closed' and c.model_version=2 and q.model_version=2 and q.code=i->>'code' group by q.id having count(a.rating)>=5 and to_jsonb(round(100.0*count(*) filter(where a.rating>=4)/nullif(count(a.rating),0),1))=i->'favorablePercent')) then return false; end if;
insert into aurea_private.weekly_report_digests(organization_id,week_start,digest) values(j.organization_id,j.week_start,p_digest) on conflict(organization_id,week_start) do nothing;
select digest into saved from aurea_private.weekly_report_digests where organization_id=j.organization_id and week_start=j.week_start;
return saved=p_digest;
end $function$
;
CREATE OR REPLACE FUNCTION aurea_private.reserve_recipient_delivery(p_job bigint, p_lease uuid, p_recipient uuid, p_key text)
 RETURNS text
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare j aurea_private.weekly_delivery_jobs%rowtype; s text; k text;
begin
 if session_user not in ('aurea_delivery_login','postgres') then raise exception 'Delivery access denied' using errcode='42501'; end if;
select * into j from aurea_private.weekly_delivery_jobs where id=p_job and status='processing' and lease_token=p_lease and lease_expires_at>clock_timestamp() for update;
if not found then return 'blocked'; end if;
if p_key is distinct from encode(sha256(convert_to(j.organization_id::text||':'||j.week_start::text||':'||j.action||':'||p_recipient::text,'UTF8')),'hex') then return 'blocked'; end if;
select state,idempotency_key into s,k from aurea_private.recipient_delivery_receipts where job_id=p_job and recipient_id=p_recipient;
if found then return case when k=p_key and s='confirmed' then 'confirmed' else 'blocked' end; end if;
if j.action='report' then
 if not exists(select 1 from aurea_private.memberships m join aurea_private.cycles c on c.organization_id=m.organization_id where m.organization_id=j.organization_id and m.user_id=p_recipient and m.role in ('owner','manager') and c.week_start=j.week_start and c.state='closed') then return 'ineligible'; end if;
else
 if not exists(select 1 from aurea_private.invitations i join aurea_private.cycles c on c.id=i.cycle_id where i.id=p_recipient and c.organization_id=j.organization_id and c.week_start=j.week_start and c.state='open' and i.redeemed_at is null and i.expires_at>clock_timestamp() and ((j.action='invite' and i.sent_at is null) or (j.action='reminder' and i.sent_at is not null and i.reminder_at is null))) then return 'ineligible'; end if;
end if;
insert into aurea_private.recipient_delivery_receipts(job_id,recipient_id,idempotency_key,state) values(p_job,p_recipient,p_key,'pending');
return 'reserved';
end $function$
;
revoke all on function aurea_private.delivery_snapshot(bigint,uuid,uuid,date,text), aurea_private.delivery_publications(bigint,uuid,uuid,date), aurea_private.reserve_recipient_delivery(bigint,uuid,uuid,text), aurea_private.finish_recipient_delivery(bigint,uuid,text,text,boolean), aurea_private.persist_weekly_digest(bigint,uuid,jsonb) from public,anon,authenticated,service_role,aurea_employee_login,aurea_limiter_login,aurea_rate_limiter;
grant usage on schema aurea_private to aurea_delivery_login;
grant execute on function aurea_private.delivery_snapshot(bigint,uuid,uuid,date,text), aurea_private.delivery_publications(bigint,uuid,uuid,date), aurea_private.reserve_recipient_delivery(bigint,uuid,uuid,text), aurea_private.finish_recipient_delivery(bigint,uuid,text,text,boolean), aurea_private.persist_weekly_digest(bigint,uuid,jsonb) to aurea_delivery_login;
