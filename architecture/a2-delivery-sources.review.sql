create or replace function aurea_private.delivery_snapshot(p_job bigint,p_lease uuid,p_org uuid,p_week date,p_action text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare j aurea_private.weekly_delivery_jobs%rowtype; c aurea_private.cycles%rowtype; recipients jsonb;
begin
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
end $$;
create or replace function aurea_private.delivery_publications(p_job bigint,p_lease uuid,p_org uuid,p_week date) returns table(week_start text,item_code text,item_version integer,domain text,response_count integer,favorable_percent double precision,closed boolean) language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from aurea_private.weekly_delivery_jobs j join aurea_private.cycles c on c.organization_id=j.organization_id and c.week_start=j.week_start where j.id=p_job and j.lease_token=p_lease and j.status='processing' and j.lease_expires_at>clock_timestamp() and j.organization_id=p_org and j.week_start=p_week and j.action='report' and c.state='closed') then raise exception 'Invalid report scope'; end if;
 return query select c.week_start::text,q.code,q.item_version,q.domain,count(a.rating)::integer,round(100.0*count(*) filter(where a.rating>=4)/nullif(count(a.rating),0),1)::double precision,true from aurea_private.cycles c join aurea_private.responses r on r.cycle_id=c.id join aurea_private.response_answers a on a.response_id=r.id join aurea_private.questions q on q.id=a.question_id join aurea_private.cycle_questions cq on cq.cycle_id=c.id and cq.question_id=q.id where c.organization_id=p_org and c.week_start<=p_week and c.state='closed' and c.model_version=2 and q.model_version=2 group by c.week_start,q.code,q.item_version,q.domain having count(a.rating)>=5 order by c.week_start,q.code;
end $$;
revoke all on function aurea_private.delivery_snapshot(bigint,uuid,uuid,date,text),aurea_private.delivery_publications(bigint,uuid,uuid,date) from public,anon,authenticated,service_role;