create or replace function aurea_private.reserve_recipient_delivery(p_job bigint,p_lease uuid,p_recipient uuid,p_key text) returns text language plpgsql security invoker set search_path='' as $$
declare j aurea_private.weekly_delivery_jobs%rowtype; s text; k text;
begin
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
end $$;
create or replace function aurea_private.finish_recipient_delivery(p_job bigint,p_lease uuid,p_key text,p_provider text,p_confirm boolean) returns boolean language plpgsql security invoker set search_path='' as $$
declare j aurea_private.weekly_delivery_jobs%rowtype; rid uuid;
begin
select * into j from aurea_private.weekly_delivery_jobs where id=p_job and status='processing' and lease_token=p_lease and lease_expires_at>clock_timestamp() for update;
if not found or p_confirm is null or (p_confirm and (p_provider is null or length(trim(p_provider)) not between 1 and 512)) then return false; end if;
update aurea_private.recipient_delivery_receipts set state=case when p_confirm then 'confirmed' else 'uncertain' end,provider_id=case when p_confirm then p_provider else null end,updated_at=clock_timestamp() where job_id=p_job and idempotency_key=p_key and state='pending' returning recipient_id into rid;
if not found then return false; end if;
if p_confirm and j.action='invite' then update aurea_private.invitations set sent_at=coalesce(sent_at,clock_timestamp()) where id=rid;
elsif p_confirm and j.action='reminder' then update aurea_private.invitations set reminder_at=coalesce(reminder_at,clock_timestamp()) where id=rid; end if;
return true;
end $$;
revoke all on function aurea_private.reserve_recipient_delivery(bigint,uuid,uuid,text), aurea_private.finish_recipient_delivery(bigint,uuid,text,text,boolean) from public,anon,authenticated,service_role;