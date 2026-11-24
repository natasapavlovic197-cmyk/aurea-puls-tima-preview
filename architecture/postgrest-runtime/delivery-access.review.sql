-- REVIEW ONLY: no migration applied. Legacy functions unchanged; isolated copies reuse their logic with scoped authorization.
BEGIN;
CREATE SCHEMA aurea_delivery_rpc;
REVOKE ALL ON SCHEMA aurea_delivery_rpc FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE aurea_delivery_rpc.identities(user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE);
CREATE TABLE aurea_delivery_rpc.scopes(user_id uuid REFERENCES aurea_delivery_rpc.identities(user_id) ON DELETE CASCADE, organization_id uuid REFERENCES aurea_private.organizations(id) ON DELETE CASCADE, PRIMARY KEY(user_id,organization_id));
ALTER TABLE aurea_delivery_rpc.scopes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE aurea_delivery_rpc.scopes FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE aurea_delivery_rpc.identities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE aurea_delivery_rpc.identities FROM PUBLIC,anon,authenticated,service_role;
-- Authorization gate uses dedicated allowlist AND live session. No manager privileges.
CREATE FUNCTION aurea_delivery_rpc.authorize() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM aurea_delivery_rpc.identities i JOIN auth.sessions s ON s.user_id=i.user_id JOIN auth.users u ON u.id=i.user_id WHERE i.user_id=auth.uid() AND s.id::text=auth.jwt()->>'session_id' AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<=clock_timestamp()) AND (s.not_after IS NULL OR s.not_after>clock_timestamp())) THEN
  RAISE EXCEPTION 'Delivery access denied' USING ERRCODE='42501';
 END IF;
END $$;
REVOKE ALL ON FUNCTION aurea_delivery_rpc.authorize() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION aurea_delivery_rpc.allowed_org(p_org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $ SELECT EXISTS(SELECT 1 FROM aurea_delivery_rpc.scopes s WHERE s.user_id=auth.uid() AND s.organization_id=p_org) $;
REVOKE ALL ON FUNCTION aurea_delivery_rpc.allowed_org(uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION aurea_delivery_rpc.require_org(p_org uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $ BEGIN PERFORM aurea_delivery_rpc.authorize(); IF NOT aurea_delivery_rpc.allowed_org(p_org) THEN RAISE EXCEPTION 'Delivery scope denied' USING ERRCODE='42501'; END IF; END $;
REVOKE ALL ON FUNCTION aurea_delivery_rpc.require_org(uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION aurea_delivery_rpc.require_job(p_job bigint,p_lease uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $ BEGIN PERFORM aurea_delivery_rpc.authorize(); IF NOT EXISTS(SELECT 1 FROM aurea_private.weekly_delivery_jobs j WHERE j.id=p_job AND j.lease_token=p_lease AND j.status='processing' AND j.lease_expires_at>clock_timestamp() AND aurea_delivery_rpc.allowed_org(j.organization_id)) THEN RAISE EXCEPTION 'Delivery scope denied' USING ERRCODE='42501'; END IF; END $;
REVOKE ALL ON FUNCTION aurea_delivery_rpc.require_job(bigint,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION aurea_delivery_rpc.impl_claim_weekly_delivery_job(p_lease_token uuid, p_now timestamp with time zone DEFAULT now())
 RETURNS TABLE(id bigint, organization_id uuid, week_start date, action text, lease_token uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 perform aurea_delivery_rpc.authorize();
 if p_lease_token is null then raise exception 'lease token required'; end if;
 return query
 with candidate as (
  select j.id from aurea_private.weekly_delivery_jobs j
  where aurea_delivery_rpc.allowed_org(j.organization_id) and ((j.status in ('pending','failed') and j.next_attempt_at<=p_now)
       or (j.status='processing' and j.lease_expires_at<p_now))
    and j.attempt_count<5
  order by j.next_attempt_at,j.created_at,j.id
  for update skip locked limit 1
 )
 update aurea_private.weekly_delivery_jobs j
 set status='processing',lease_token=p_lease_token,
     lease_expires_at=p_now+interval '5 minutes',
     attempt_count=j.attempt_count+1,updated_at=p_now
 from candidate where j.id=candidate.id
 returning j.id,j.organization_id,j.week_start,j.action,j.lease_token;
end $function$
;

CREATE FUNCTION aurea_delivery_rpc.impl_delivery_publications(p_job bigint, p_lease uuid, p_org uuid, p_week date)
 RETURNS TABLE(week_start text, item_code text, item_version integer, domain text, response_count integer, favorable_percent double precision, closed boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 perform aurea_delivery_rpc.require_job(p_job,p_lease); perform aurea_delivery_rpc.require_org(p_org);
 if not exists(select 1 from aurea_private.weekly_delivery_jobs j join aurea_private.cycles c on c.organization_id=j.organization_id and c.week_start=j.week_start where j.id=p_job and j.lease_token=p_lease and j.status='processing' and j.lease_expires_at>clock_timestamp() and j.organization_id=p_org and j.week_start=p_week and j.action='report' and c.state='closed') then raise exception 'Invalid report scope'; end if;
 return query select c.week_start::text,q.code,q.item_version,q.domain,count(a.rating)::integer,round(100.0*count(*) filter(where a.rating>=4)/nullif(count(a.rating),0),1)::double precision,true from aurea_private.cycles c join aurea_private.responses r on r.cycle_id=c.id join aurea_private.response_answers a on a.response_id=r.id join aurea_private.questions q on q.id=a.question_id join aurea_private.cycle_questions cq on cq.cycle_id=c.id and cq.question_id=q.id where c.organization_id=p_org and c.week_start<=p_week and c.state='closed' and c.model_version=2 and q.model_version=2 group by c.week_start,q.code,q.item_version,q.domain having count(a.rating)>=5 order by c.week_start,q.code;
end $function$
;

CREATE FUNCTION aurea_delivery_rpc.impl_delivery_snapshot(p_job bigint, p_lease uuid, p_org uuid, p_week date, p_action text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare j aurea_private.weekly_delivery_jobs%rowtype; c aurea_private.cycles%rowtype; recipients jsonb;
begin
 perform aurea_delivery_rpc.require_job(p_job,p_lease); perform aurea_delivery_rpc.require_org(p_org);
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

CREATE FUNCTION aurea_delivery_rpc.impl_finish_recipient_delivery(p_job bigint, p_lease uuid, p_key text, p_provider text, p_confirm boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare j aurea_private.weekly_delivery_jobs%rowtype; rid uuid;
begin
 perform aurea_delivery_rpc.require_job(p_job,p_lease);
select * into j from aurea_private.weekly_delivery_jobs where id=p_job and status='processing' and lease_token=p_lease and lease_expires_at>clock_timestamp() for update;
if not found or p_confirm is null or (p_confirm and (p_provider is null or length(trim(p_provider)) not between 1 and 512)) then return false; end if;
update aurea_private.recipient_delivery_receipts set state=case when p_confirm then 'confirmed' else 'uncertain' end,provider_id=case when p_confirm then p_provider else null end,updated_at=clock_timestamp() where job_id=p_job and idempotency_key=p_key and state='pending' returning recipient_id into rid;
if not found then return false; end if;
if p_confirm and j.action='invite' then update aurea_private.invitations set sent_at=coalesce(sent_at,clock_timestamp()) where id=rid;
elsif p_confirm and j.action='reminder' then update aurea_private.invitations set reminder_at=coalesce(reminder_at,clock_timestamp()) where id=rid; end if;
return true;
end $function$
;

CREATE FUNCTION aurea_delivery_rpc.impl_finish_weekly_delivery_job(p_id bigint, p_lease_token uuid, p_success boolean, p_now timestamp with time zone DEFAULT now())
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare changed bigint;
begin
 perform aurea_delivery_rpc.require_job(p_id,p_lease_token);
 if p_id is null or p_lease_token is null or p_success is null then return false; end if;
 update aurea_private.weekly_delivery_jobs j
 set status=case when p_success then 'delivered' else 'failed' end,
     delivered_at=case when p_success then p_now else null end,
     next_attempt_at=case when p_success then j.next_attempt_at else p_now + make_interval(mins => least(60, power(2,j.attempt_count)::integer)) end,
     lease_token=null,lease_expires_at=null,updated_at=p_now
 where j.id=p_id and j.lease_token=p_lease_token and j.status='processing'
   and j.lease_expires_at>=p_now;
 get diagnostics changed=row_count;
 return changed=1;
end $function$
;

CREATE FUNCTION aurea_delivery_rpc.impl_issue_hmac_invitation(p_org uuid, p_week date, p_id uuid, p_address text, p_hash text, p_expires timestamp with time zone)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c uuid; existing aurea_private.invitations%rowtype; inserted uuid; addr text:=lower(btrim(p_address));
begin
 perform aurea_delivery_rpc.require_org(p_org);
 if p_org is null or p_week is null or extract(isodow from p_week)<>1 or p_id is null or addr is null or length(addr)>254 or addr !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+p_lease_token uuid) RETURNS TABLE(id bigint, organization_id uuid, week_start date, action text, lease_token uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM aurea_delivery_rpc.authorize();
 RETURN QUERY select * from aurea_delivery_rpc.impl_claim_weekly_delivery_job(p_lease_token);
END $$;
REVOKE ALL ON FUNCTION aurea_delivery_rpc.claim(uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.aurea_delivery_claim(p_lease_token uuid) RETURNS TABLE(id bigint, organization_id uuid, week_start date, action text, lease_token uuid) LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM aurea_delivery_rpc.claim(p_lease_token) $$;
REVOKE ALL ON FUNCTION public.aurea_delivery_claim(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION aurea_delivery_rpc.finish(p_id bigint,p_lease_token uuid,p_success boolean) RETURNS TABLE(finished boolean) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM aurea_delivery_rpc.authorize();
 RETURN QUERY select aurea_delivery_rpc.impl_finish_weekly_delivery_job(p_id,p_lease_token,p_success);
END $$;
REVOKE ALL ON FUNCTION aurea_delivery_rpc.finish(bigint,uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.aurea_delivery_finish(p_id bigint,p_lease_token uuid,p_success boolean) RETURNS TABLE(finished boolean) LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM aurea_delivery_rpc.finish(p_id,p_lease_token,p_success) $$;
REVOKE ALL ON FUNCTION public.aurea_delivery_finish(bigint,uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION aurea_delivery_rpc.snapshot(p_job bigint,p_lease uuid,p_org uuid,p_week date,p_action text) RETURNS TABLE(snapshot jsonb) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM aurea_delivery_rpc.authorize();
 RETURN QUERY select aurea_delivery_rpc.impl_delivery_snapshot(p_job,p_lease,p_org,p_week,p_action);
END $$;
REVOKE ALL ON FUNCTION aurea_delivery_rpc.snapshot(bigint,uuid,uuid,date,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.aurea_delivery_snapshot(p_job bigint,p_lease uuid,p_org uuid,p_week date,p_action text) RETURNS TABLE(snapshot jsonb) LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM aurea_delivery_rpc.snapshot(p_job,p_lease,p_org,p_week,p_action) $$;
REVOKE ALL ON FUNCTION public.aurea_delivery_snapshot(bigint,uuid,uuid,date,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION aurea_delivery_rpc.publications(p_job bigint,p_lease uuid,p_org uuid,p_week date) RETURNS TABLE(week_start text,item_code text,item_version integer,domain text,response_count integer,favorable_percent double precision,closed boolean) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM aurea_delivery_rpc.authorize();
 RETURN QUERY select * from aurea_delivery_rpc.impl_delivery_publications(p_job,p_lease,p_org,p_week);
END $$;
REVOKE ALL ON FUNCTION aurea_delivery_rpc.publications(bigint,uuid,uuid,date) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.aurea_delivery_publications(p_job bigint,p_lease uuid,p_org uuid,p_week date) RETURNS TABLE(week_start text,item_code text,item_version integer,domain text,response_count integer,favorable_percent double precision,closed boolean) LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM aurea_delivery_rpc.publications(p_job,p_lease,p_org,p_week) $$;
REVOKE ALL ON FUNCTION public.aurea_delivery_publications(bigint,uuid,uuid,date) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION aurea_delivery_rpc.reserve(p_job bigint,p_lease uuid,p_recipient uuid,p_key text) RETURNS TABLE(state text) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM aurea_delivery_rpc.authorize();
 RETURN QUERY select aurea_delivery_rpc.impl_reserve_recipient_delivery(p_job,p_lease,p_recipient,p_key);
END $$;
REVOKE ALL ON FUNCTION aurea_delivery_rpc.reserve(bigint,uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.aurea_delivery_reserve(p_job bigint,p_lease uuid,p_recipient uuid,p_key text) RETURNS TABLE(state text) LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM aurea_delivery_rpc.reserve(p_job,p_lease,p_recipient,p_key) $$;
REVOKE ALL ON FUNCTION public.aurea_delivery_reserve(bigint,uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION aurea_delivery_rpc.receipt(p_job bigint,p_lease uuid,p_key text,p_provider text,p_confirm boolean) RETURNS TABLE(finished boolean) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM aurea_delivery_rpc.authorize();
 RETURN QUERY select aurea_delivery_rpc.impl_finish_recipient_delivery(p_job,p_lease,p_key,p_provider,p_confirm);
END $$;
REVOKE ALL ON FUNCTION aurea_delivery_rpc.receipt(bigint,uuid,text,text,boolean) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.aurea_delivery_receipt(p_job bigint,p_lease uuid,p_key text,p_provider text,p_confirm boolean) RETURNS TABLE(finished boolean) LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM aurea_delivery_rpc.receipt(p_job,p_lease,p_key,p_provider,p_confirm) $$;
REVOKE ALL ON FUNCTION public.aurea_delivery_receipt(bigint,uuid,text,text,boolean) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION aurea_delivery_rpc.digest(p_job bigint,p_lease uuid,p_digest jsonb) RETURNS TABLE(finished boolean) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM aurea_delivery_rpc.authorize();
 RETURN QUERY select aurea_delivery_rpc.impl_persist_weekly_digest(p_job,p_lease,p_digest);
END $$;
REVOKE ALL ON FUNCTION aurea_delivery_rpc.digest(bigint,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.aurea_delivery_digest(p_job bigint,p_lease uuid,p_digest jsonb) RETURNS TABLE(finished boolean) LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM aurea_delivery_rpc.digest(p_job,p_lease,p_digest) $$;
REVOKE ALL ON FUNCTION public.aurea_delivery_digest(bigint,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION aurea_delivery_rpc.issue(p_org uuid,p_week date,p_id uuid,p_address text,p_hash text,p_expires timestamptz) RETURNS TABLE(state text) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM aurea_delivery_rpc.authorize();
 RETURN QUERY select aurea_delivery_rpc.impl_issue_hmac_invitation(p_org,p_week,p_id,p_address,p_hash,p_expires);
END $$;
REVOKE ALL ON FUNCTION aurea_delivery_rpc.issue(uuid,date,uuid,text,text,timestamptz) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.aurea_delivery_issue(p_org uuid,p_week date,p_id uuid,p_address text,p_hash text,p_expires timestamptz) RETURNS TABLE(state text) LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM aurea_delivery_rpc.issue(p_org,p_week,p_id,p_address,p_hash,p_expires) $$;
REVOKE ALL ON FUNCTION public.aurea_delivery_issue(uuid,date,uuid,text,text,timestamptz) FROM PUBLIC,anon,authenticated,service_role;

GRANT USAGE ON SCHEMA aurea_delivery_rpc TO authenticated;
GRANT EXECUTE ON FUNCTION public.aurea_delivery_claim(uuid), aurea_delivery_rpc.claim(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aurea_delivery_finish(bigint,uuid,boolean), aurea_delivery_rpc.finish(bigint,uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aurea_delivery_snapshot(bigint,uuid,uuid,date,text), aurea_delivery_rpc.snapshot(bigint,uuid,uuid,date,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aurea_delivery_publications(bigint,uuid,uuid,date), aurea_delivery_rpc.publications(bigint,uuid,uuid,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aurea_delivery_reserve(bigint,uuid,uuid,text), aurea_delivery_rpc.reserve(bigint,uuid,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aurea_delivery_receipt(bigint,uuid,text,text,boolean), aurea_delivery_rpc.receipt(bigint,uuid,text,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aurea_delivery_digest(bigint,uuid,jsonb), aurea_delivery_rpc.digest(bigint,uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aurea_delivery_issue(uuid,date,uuid,text,text,timestamptz), aurea_delivery_rpc.issue(uuid,date,uuid,text,text,timestamptz) TO authenticated;
COMMIT;
 or p_hash is null or p_hash !~ '^[a-f0-9]{64}p_lease_token uuid) RETURNS TABLE(id bigint, organization_id uuid, week_start date, action text, lease_token uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM aurea_delivery_rpc.authorize();
 RETURN QUERY select * from aurea_delivery_rpc.impl_claim_weekly_delivery_job(p_lease_token);
END $$;
REVOKE ALL ON FUNCTION aurea_delivery_rpc.claim(uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.aurea_delivery_claim(p_lease_token uuid) RETURNS TABLE(id bigint, organization_id uuid, week_start date, action text, lease_token uuid) LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM aurea_delivery_rpc.claim(p_lease_token) $$;
REVOKE ALL ON FUNCTION public.aurea_delivery_claim(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION aurea_delivery_rpc.finish(p_id bigint,p_lease_token uuid,p_success boolean) RETURNS TABLE(finished boolean) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM aurea_delivery_rpc.authorize();
 RETURN QUERY select aurea_delivery_rpc.impl_finish_weekly_delivery_job(p_id,p_lease_token,p_success);
END $$;
REVOKE ALL ON FUNCTION aurea_delivery_rpc.finish(bigint,uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.aurea_delivery_finish(p_id bigint,p_lease_token uuid,p_success boolean) RETURNS TABLE(finished boolean) LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM aurea_delivery_rpc.finish(p_id,p_lease_token,p_success) $$;
REVOKE ALL ON FUNCTION public.aurea_delivery_finish(bigint,uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION aurea_delivery_rpc.snapshot(p_job bigint,p_lease uuid,p_org uuid,p_week date,p_action text) RETURNS TABLE(snapshot jsonb) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM aurea_delivery_rpc.authorize();
 RETURN QUERY select aurea_delivery_rpc.impl_delivery_snapshot(p_job,p_lease,p_org,p_week,p_action);
END $$;
REVOKE ALL ON FUNCTION aurea_delivery_rpc.snapshot(bigint,uuid,uuid,date,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.aurea_delivery_snapshot(p_job bigint,p_lease uuid,p_org uuid,p_week date,p_action text) RETURNS TABLE(snapshot jsonb) LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM aurea_delivery_rpc.snapshot(p_job,p_lease,p_org,p_week,p_action) $$;
REVOKE ALL ON FUNCTION public.aurea_delivery_snapshot(bigint,uuid,uuid,date,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION aurea_delivery_rpc.publications(p_job bigint,p_lease uuid,p_org uuid,p_week date) RETURNS TABLE(week_start text,item_code text,item_version integer,domain text,response_count integer,favorable_percent double precision,closed boolean) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM aurea_delivery_rpc.authorize();
 RETURN QUERY select * from aurea_delivery_rpc.impl_delivery_publications(p_job,p_lease,p_org,p_week);
END $$;
REVOKE ALL ON FUNCTION aurea_delivery_rpc.publications(bigint,uuid,uuid,date) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.aurea_delivery_publications(p_job bigint,p_lease uuid,p_org uuid,p_week date) RETURNS TABLE(week_start text,item_code text,item_version integer,domain text,response_count integer,favorable_percent double precision,closed boolean) LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM aurea_delivery_rpc.publications(p_job,p_lease,p_org,p_week) $$;
REVOKE ALL ON FUNCTION public.aurea_delivery_publications(bigint,uuid,uuid,date) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION aurea_delivery_rpc.reserve(p_job bigint,p_lease uuid,p_recipient uuid,p_key text) RETURNS TABLE(state text) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM aurea_delivery_rpc.authorize();
 RETURN QUERY select aurea_delivery_rpc.impl_reserve_recipient_delivery(p_job,p_lease,p_recipient,p_key);
END $$;
REVOKE ALL ON FUNCTION aurea_delivery_rpc.reserve(bigint,uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.aurea_delivery_reserve(p_job bigint,p_lease uuid,p_recipient uuid,p_key text) RETURNS TABLE(state text) LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM aurea_delivery_rpc.reserve(p_job,p_lease,p_recipient,p_key) $$;
REVOKE ALL ON FUNCTION public.aurea_delivery_reserve(bigint,uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION aurea_delivery_rpc.receipt(p_job bigint,p_lease uuid,p_key text,p_provider text,p_confirm boolean) RETURNS TABLE(finished boolean) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM aurea_delivery_rpc.authorize();
 RETURN QUERY select aurea_delivery_rpc.impl_finish_recipient_delivery(p_job,p_lease,p_key,p_provider,p_confirm);
END $$;
REVOKE ALL ON FUNCTION aurea_delivery_rpc.receipt(bigint,uuid,text,text,boolean) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.aurea_delivery_receipt(p_job bigint,p_lease uuid,p_key text,p_provider text,p_confirm boolean) RETURNS TABLE(finished boolean) LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM aurea_delivery_rpc.receipt(p_job,p_lease,p_key,p_provider,p_confirm) $$;
REVOKE ALL ON FUNCTION public.aurea_delivery_receipt(bigint,uuid,text,text,boolean) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION aurea_delivery_rpc.digest(p_job bigint,p_lease uuid,p_digest jsonb) RETURNS TABLE(finished boolean) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM aurea_delivery_rpc.authorize();
 RETURN QUERY select aurea_delivery_rpc.impl_persist_weekly_digest(p_job,p_lease,p_digest);
END $$;
REVOKE ALL ON FUNCTION aurea_delivery_rpc.digest(bigint,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.aurea_delivery_digest(p_job bigint,p_lease uuid,p_digest jsonb) RETURNS TABLE(finished boolean) LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM aurea_delivery_rpc.digest(p_job,p_lease,p_digest) $$;
REVOKE ALL ON FUNCTION public.aurea_delivery_digest(bigint,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION aurea_delivery_rpc.issue(p_org uuid,p_week date,p_id uuid,p_address text,p_hash text,p_expires timestamptz) RETURNS TABLE(state text) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM aurea_delivery_rpc.authorize();
 RETURN QUERY select aurea_delivery_rpc.impl_issue_hmac_invitation(p_org,p_week,p_id,p_address,p_hash,p_expires);
END $$;
REVOKE ALL ON FUNCTION aurea_delivery_rpc.issue(uuid,date,uuid,text,text,timestamptz) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.aurea_delivery_issue(p_org uuid,p_week date,p_id uuid,p_address text,p_hash text,p_expires timestamptz) RETURNS TABLE(state text) LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM aurea_delivery_rpc.issue(p_org,p_week,p_id,p_address,p_hash,p_expires) $$;
REVOKE ALL ON FUNCTION public.aurea_delivery_issue(uuid,date,uuid,text,text,timestamptz) FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
 or p_expires is null or p_expires<=clock_timestamp() or p_expires>(p_week+7)::timestamp at time zone 'Europe/Belgrade' then return 'invalid'; end if;
 select id into c from aurea_private.cycles where organization_id=p_org and week_start=p_week and state in ('draft','open') and model_version=2 for update;
 if not found then return 'unavailable'; end if;
 select * into existing from aurea_private.invitations where cycle_id=c and lower(btrim(recipient_address))=addr;
 if found then
  if existing.id=p_id and existing.token_hash=p_hash and existing.expires_at=p_expires then return 'existing'; end if;
  return 'conflict';
 end if;
 insert into aurea_private.invitations(id,cycle_id,recipient_address,token_hash,expires_at) values(p_id,c,addr,p_hash,p_expires) on conflict do nothing returning id into inserted;
 return case when inserted is null then 'conflict' else 'created' end;
end $function$
;

CREATE FUNCTION aurea_delivery_rpc.impl_persist_weekly_digest(p_job bigint, p_lease uuid, p_digest jsonb)
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
if exists(select 1 from jsonb_array_elements(p_digest->'domains') d cross join lateral jsonb_array_elements(d->'items') i where jsonb_typeof(i) is distinct from 'object' or exists(select 1 from jsonb_object_keys(i) k where k not in ('code','favorablePercent')) or not exists(select 1 from aurea_private.cycles c join aurea_private.responses r on r.cycle_id=c.id join aurea_private.response_answers a on a.response_id=r.id join aurea_private.questions q on q.id=a.question_id join aurea_private.cycle_questions cq on cq.cycle_id=c.id and cq.question_id=q.id where c.organization_id=j.organization_id and c.week_start=j.week_start and c.state='closed' and c.model_version=2 and q.model_version=2 and q.code=i->>'code' group by q.id having count(a.rating)>=5 and to_jsonb(round(100.0*count(*) filter(where a.rating>=4)/nullif(count(a.rating),0),1))=i->'favorablePercent')) then return false; end if;
insert into aurea_private.weekly_report_digests(organization_id,week_start,digest) values(j.organization_id,j.week_start,p_digest) on conflict(organization_id,week_start) do nothing;
select digest into saved from aurea_private.weekly_report_digests where organization_id=j.organization_id and week_start=j.week_start;
return saved=p_digest;
end $function$
;

CREATE FUNCTION aurea_delivery_rpc.impl_reserve_recipient_delivery(p_job bigint, p_lease uuid, p_recipient uuid, p_key text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare j aurea_private.weekly_delivery_jobs%rowtype; s text; k text;
begin
 perform aurea_delivery_rpc.require_job(p_job,p_lease);
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

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA aurea_delivery_rpc FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION aurea_delivery_rpc.claim(p_lease_token uuid) RETURNS TABLE(id bigint, organization_id uuid, week_start date, action text, lease_token uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM aurea_delivery_rpc.authorize();
 RETURN QUERY select * from aurea_delivery_rpc.impl_claim_weekly_delivery_job(p_lease_token);
END $$;
REVOKE ALL ON FUNCTION aurea_delivery_rpc.claim(uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.aurea_delivery_claim(p_lease_token uuid) RETURNS TABLE(id bigint, organization_id uuid, week_start date, action text, lease_token uuid) LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM aurea_delivery_rpc.claim(p_lease_token) $$;
REVOKE ALL ON FUNCTION public.aurea_delivery_claim(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION aurea_delivery_rpc.finish(p_id bigint,p_lease_token uuid,p_success boolean) RETURNS TABLE(finished boolean) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM aurea_delivery_rpc.authorize();
 RETURN QUERY select aurea_delivery_rpc.impl_finish_weekly_delivery_job(p_id,p_lease_token,p_success);
END $$;
REVOKE ALL ON FUNCTION aurea_delivery_rpc.finish(bigint,uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.aurea_delivery_finish(p_id bigint,p_lease_token uuid,p_success boolean) RETURNS TABLE(finished boolean) LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM aurea_delivery_rpc.finish(p_id,p_lease_token,p_success) $$;
REVOKE ALL ON FUNCTION public.aurea_delivery_finish(bigint,uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION aurea_delivery_rpc.snapshot(p_job bigint,p_lease uuid,p_org uuid,p_week date,p_action text) RETURNS TABLE(snapshot jsonb) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM aurea_delivery_rpc.authorize();
 RETURN QUERY select aurea_delivery_rpc.impl_delivery_snapshot(p_job,p_lease,p_org,p_week,p_action);
END $$;
REVOKE ALL ON FUNCTION aurea_delivery_rpc.snapshot(bigint,uuid,uuid,date,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.aurea_delivery_snapshot(p_job bigint,p_lease uuid,p_org uuid,p_week date,p_action text) RETURNS TABLE(snapshot jsonb) LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM aurea_delivery_rpc.snapshot(p_job,p_lease,p_org,p_week,p_action) $$;
REVOKE ALL ON FUNCTION public.aurea_delivery_snapshot(bigint,uuid,uuid,date,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION aurea_delivery_rpc.publications(p_job bigint,p_lease uuid,p_org uuid,p_week date) RETURNS TABLE(week_start text,item_code text,item_version integer,domain text,response_count integer,favorable_percent double precision,closed boolean) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM aurea_delivery_rpc.authorize();
 RETURN QUERY select * from aurea_delivery_rpc.impl_delivery_publications(p_job,p_lease,p_org,p_week);
END $$;
REVOKE ALL ON FUNCTION aurea_delivery_rpc.publications(bigint,uuid,uuid,date) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.aurea_delivery_publications(p_job bigint,p_lease uuid,p_org uuid,p_week date) RETURNS TABLE(week_start text,item_code text,item_version integer,domain text,response_count integer,favorable_percent double precision,closed boolean) LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM aurea_delivery_rpc.publications(p_job,p_lease,p_org,p_week) $$;
REVOKE ALL ON FUNCTION public.aurea_delivery_publications(bigint,uuid,uuid,date) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION aurea_delivery_rpc.reserve(p_job bigint,p_lease uuid,p_recipient uuid,p_key text) RETURNS TABLE(state text) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM aurea_delivery_rpc.authorize();
 RETURN QUERY select aurea_delivery_rpc.impl_reserve_recipient_delivery(p_job,p_lease,p_recipient,p_key);
END $$;
REVOKE ALL ON FUNCTION aurea_delivery_rpc.reserve(bigint,uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.aurea_delivery_reserve(p_job bigint,p_lease uuid,p_recipient uuid,p_key text) RETURNS TABLE(state text) LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM aurea_delivery_rpc.reserve(p_job,p_lease,p_recipient,p_key) $$;
REVOKE ALL ON FUNCTION public.aurea_delivery_reserve(bigint,uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION aurea_delivery_rpc.receipt(p_job bigint,p_lease uuid,p_key text,p_provider text,p_confirm boolean) RETURNS TABLE(finished boolean) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM aurea_delivery_rpc.authorize();
 RETURN QUERY select aurea_delivery_rpc.impl_finish_recipient_delivery(p_job,p_lease,p_key,p_provider,p_confirm);
END $$;
REVOKE ALL ON FUNCTION aurea_delivery_rpc.receipt(bigint,uuid,text,text,boolean) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.aurea_delivery_receipt(p_job bigint,p_lease uuid,p_key text,p_provider text,p_confirm boolean) RETURNS TABLE(finished boolean) LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM aurea_delivery_rpc.receipt(p_job,p_lease,p_key,p_provider,p_confirm) $$;
REVOKE ALL ON FUNCTION public.aurea_delivery_receipt(bigint,uuid,text,text,boolean) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION aurea_delivery_rpc.digest(p_job bigint,p_lease uuid,p_digest jsonb) RETURNS TABLE(finished boolean) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM aurea_delivery_rpc.authorize();
 RETURN QUERY select aurea_delivery_rpc.impl_persist_weekly_digest(p_job,p_lease,p_digest);
END $$;
REVOKE ALL ON FUNCTION aurea_delivery_rpc.digest(bigint,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.aurea_delivery_digest(p_job bigint,p_lease uuid,p_digest jsonb) RETURNS TABLE(finished boolean) LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM aurea_delivery_rpc.digest(p_job,p_lease,p_digest) $$;
REVOKE ALL ON FUNCTION public.aurea_delivery_digest(bigint,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION aurea_delivery_rpc.issue(p_org uuid,p_week date,p_id uuid,p_address text,p_hash text,p_expires timestamptz) RETURNS TABLE(state text) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM aurea_delivery_rpc.authorize();
 RETURN QUERY select aurea_delivery_rpc.impl_issue_hmac_invitation(p_org,p_week,p_id,p_address,p_hash,p_expires);
END $$;
REVOKE ALL ON FUNCTION aurea_delivery_rpc.issue(uuid,date,uuid,text,text,timestamptz) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.aurea_delivery_issue(p_org uuid,p_week date,p_id uuid,p_address text,p_hash text,p_expires timestamptz) RETURNS TABLE(state text) LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM aurea_delivery_rpc.issue(p_org,p_week,p_id,p_address,p_hash,p_expires) $$;
REVOKE ALL ON FUNCTION public.aurea_delivery_issue(uuid,date,uuid,text,text,timestamptz) FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
