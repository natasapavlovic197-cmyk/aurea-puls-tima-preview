create unique index invitations_cycle_recipient_unique on aurea_private.invitations(cycle_id,lower(btrim(recipient_address)));
create or replace function aurea_private.issue_hmac_invitation(p_org uuid,p_week date,p_id uuid,p_address text,p_hash text,p_expires timestamptz) returns text language plpgsql security definer set search_path='' as $$
declare c uuid; existing aurea_private.invitations%rowtype; inserted uuid; addr text:=lower(btrim(p_address));
begin
 if session_user not in ('aurea_delivery_login','postgres') then raise exception 'Access denied' using errcode='42501'; end if;
 if p_org is null or p_week is null or extract(isodow from p_week)<>1 or p_id is null or addr is null or length(addr)>254 or addr !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' or p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_expires is null or p_expires<=clock_timestamp() or p_expires>(p_week+7)::timestamp at time zone 'Europe/Belgrade' then return 'invalid'; end if;
 select id into c from aurea_private.cycles where organization_id=p_org and week_start=p_week and state in ('draft','open') and model_version=2 for update;
 if not found then return 'unavailable'; end if;
 select * into existing from aurea_private.invitations where cycle_id=c and lower(btrim(recipient_address))=addr;
 if found then
  if existing.id=p_id and existing.token_hash=p_hash and existing.expires_at=p_expires then return 'existing'; end if;
  return 'conflict';
 end if;
 insert into aurea_private.invitations(id,cycle_id,recipient_address,token_hash,expires_at) values(p_id,c,addr,p_hash,p_expires) on conflict do nothing returning id into inserted;
 return case when inserted is null then 'conflict' else 'created' end;
end $$;
revoke all on function aurea_private.issue_hmac_invitation(uuid,date,uuid,text,text,timestamptz) from public,anon,authenticated,service_role,aurea_employee_login,aurea_limiter_login,aurea_rate_limiter;
grant execute on function aurea_private.issue_hmac_invitation(uuid,date,uuid,text,text,timestamptz) to aurea_delivery_login;