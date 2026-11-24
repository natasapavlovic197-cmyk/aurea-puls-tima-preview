-- REVIEW ONLY. NOT APPLIED. Empty identity allowlist by default.
-- Existing private delivery functions check session_user; PostgREST uses authenticator.
-- Do not remove those checks or grant access until a separately reviewed private
-- execution boundary is established. This migration deliberately FAILS CLOSED.
BEGIN;
CREATE SCHEMA aurea_delivery_rpc;
REVOKE ALL ON SCHEMA aurea_delivery_rpc FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE aurea_delivery_rpc.identities(user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE);
ALTER TABLE aurea_delivery_rpc.identities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE aurea_delivery_rpc.identities FROM PUBLIC,anon,authenticated,service_role;
-- Authorization gate uses dedicated allowlist AND live session. No manager privileges.
CREATE FUNCTION aurea_delivery_rpc.authorize() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM aurea_delivery_rpc.identities i JOIN auth.sessions s ON s.user_id=i.user_id WHERE i.user_id=auth.uid() AND s.id::text=auth.jwt()->>'session_id') THEN
  RAISE EXCEPTION 'Delivery access denied' USING ERRCODE='42501';
 END IF;
END $$;
REVOKE ALL ON FUNCTION aurea_delivery_rpc.authorize() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION aurea_delivery_rpc.claim(p_lease_token uuid) RETURNS TABLE(id bigint, organization_id uuid, week_start date, action text, lease_token uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM aurea_delivery_rpc.authorize();
 -- Explicitly blocked until legacy session_user guard is adapted and reviewed.
 IF session_user NOT IN ('postgres','aurea_delivery_login') THEN RAISE EXCEPTION 'Delivery transport not enabled' USING ERRCODE='42501'; END IF;
 RETURN QUERY select * from aurea_private.claim_weekly_delivery_job(p_lease_token);
END $$;
REVOKE ALL ON FUNCTION aurea_delivery_rpc.claim(uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.aurea_delivery_claim(p_lease_token uuid) RETURNS TABLE(id bigint, organization_id uuid, week_start date, action text, lease_token uuid) LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM aurea_delivery_rpc.claim(p_lease_token) $$;
REVOKE ALL ON FUNCTION public.aurea_delivery_claim(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION aurea_delivery_rpc.finish(p_id bigint,p_lease_token uuid,p_success boolean) RETURNS TABLE(finished boolean) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM aurea_delivery_rpc.authorize();
 -- Explicitly blocked until legacy session_user guard is adapted and reviewed.
 IF session_user NOT IN ('postgres','aurea_delivery_login') THEN RAISE EXCEPTION 'Delivery transport not enabled' USING ERRCODE='42501'; END IF;
 RETURN QUERY select aurea_private.finish_weekly_delivery_job(p_id,p_lease_token,p_success);
END $$;
REVOKE ALL ON FUNCTION aurea_delivery_rpc.finish(bigint,uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.aurea_delivery_finish(p_id bigint,p_lease_token uuid,p_success boolean) RETURNS TABLE(finished boolean) LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM aurea_delivery_rpc.finish(p_id,p_lease_token,p_success) $$;
REVOKE ALL ON FUNCTION public.aurea_delivery_finish(bigint,uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION aurea_delivery_rpc.snapshot(p_job bigint,p_lease uuid,p_org uuid,p_week date,p_action text) RETURNS TABLE(snapshot jsonb) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM aurea_delivery_rpc.authorize();
 -- Explicitly blocked until legacy session_user guard is adapted and reviewed.
 IF session_user NOT IN ('postgres','aurea_delivery_login') THEN RAISE EXCEPTION 'Delivery transport not enabled' USING ERRCODE='42501'; END IF;
 RETURN QUERY select aurea_private.delivery_snapshot(p_job,p_lease,p_org,p_week,p_action);
END $$;
REVOKE ALL ON FUNCTION aurea_delivery_rpc.snapshot(bigint,uuid,uuid,date,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.aurea_delivery_snapshot(p_job bigint,p_lease uuid,p_org uuid,p_week date,p_action text) RETURNS TABLE(snapshot jsonb) LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM aurea_delivery_rpc.snapshot(p_job,p_lease,p_org,p_week,p_action) $$;
REVOKE ALL ON FUNCTION public.aurea_delivery_snapshot(bigint,uuid,uuid,date,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION aurea_delivery_rpc.publications(p_job bigint,p_lease uuid,p_org uuid,p_week date) RETURNS TABLE(week_start text,item_code text,item_version integer,domain text,response_count integer,favorable_percent double precision,closed boolean) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM aurea_delivery_rpc.authorize();
 -- Explicitly blocked until legacy session_user guard is adapted and reviewed.
 IF session_user NOT IN ('postgres','aurea_delivery_login') THEN RAISE EXCEPTION 'Delivery transport not enabled' USING ERRCODE='42501'; END IF;
 RETURN QUERY select * from aurea_private.delivery_publications(p_job,p_lease,p_org,p_week);
END $$;
REVOKE ALL ON FUNCTION aurea_delivery_rpc.publications(bigint,uuid,uuid,date) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.aurea_delivery_publications(p_job bigint,p_lease uuid,p_org uuid,p_week date) RETURNS TABLE(week_start text,item_code text,item_version integer,domain text,response_count integer,favorable_percent double precision,closed boolean) LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM aurea_delivery_rpc.publications(p_job,p_lease,p_org,p_week) $$;
REVOKE ALL ON FUNCTION public.aurea_delivery_publications(bigint,uuid,uuid,date) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION aurea_delivery_rpc.reserve(p_job bigint,p_lease uuid,p_recipient uuid,p_key text) RETURNS TABLE(state text) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM aurea_delivery_rpc.authorize();
 -- Explicitly blocked until legacy session_user guard is adapted and reviewed.
 IF session_user NOT IN ('postgres','aurea_delivery_login') THEN RAISE EXCEPTION 'Delivery transport not enabled' USING ERRCODE='42501'; END IF;
 RETURN QUERY select aurea_private.reserve_recipient_delivery(p_job,p_lease,p_recipient,p_key);
END $$;
REVOKE ALL ON FUNCTION aurea_delivery_rpc.reserve(bigint,uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.aurea_delivery_reserve(p_job bigint,p_lease uuid,p_recipient uuid,p_key text) RETURNS TABLE(state text) LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM aurea_delivery_rpc.reserve(p_job,p_lease,p_recipient,p_key) $$;
REVOKE ALL ON FUNCTION public.aurea_delivery_reserve(bigint,uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION aurea_delivery_rpc.receipt(p_job bigint,p_lease uuid,p_key text,p_provider text,p_confirm boolean) RETURNS TABLE(finished boolean) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM aurea_delivery_rpc.authorize();
 -- Explicitly blocked until legacy session_user guard is adapted and reviewed.
 IF session_user NOT IN ('postgres','aurea_delivery_login') THEN RAISE EXCEPTION 'Delivery transport not enabled' USING ERRCODE='42501'; END IF;
 RETURN QUERY select aurea_private.finish_recipient_delivery(p_job,p_lease,p_key,p_provider,p_confirm);
END $$;
REVOKE ALL ON FUNCTION aurea_delivery_rpc.receipt(bigint,uuid,text,text,boolean) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.aurea_delivery_receipt(p_job bigint,p_lease uuid,p_key text,p_provider text,p_confirm boolean) RETURNS TABLE(finished boolean) LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM aurea_delivery_rpc.receipt(p_job,p_lease,p_key,p_provider,p_confirm) $$;
REVOKE ALL ON FUNCTION public.aurea_delivery_receipt(bigint,uuid,text,text,boolean) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION aurea_delivery_rpc.digest(p_job bigint,p_lease uuid,p_digest jsonb) RETURNS TABLE(finished boolean) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM aurea_delivery_rpc.authorize();
 -- Explicitly blocked until legacy session_user guard is adapted and reviewed.
 IF session_user NOT IN ('postgres','aurea_delivery_login') THEN RAISE EXCEPTION 'Delivery transport not enabled' USING ERRCODE='42501'; END IF;
 RETURN QUERY select aurea_private.persist_weekly_digest(p_job,p_lease,p_digest);
END $$;
REVOKE ALL ON FUNCTION aurea_delivery_rpc.digest(bigint,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.aurea_delivery_digest(p_job bigint,p_lease uuid,p_digest jsonb) RETURNS TABLE(finished boolean) LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM aurea_delivery_rpc.digest(p_job,p_lease,p_digest) $$;
REVOKE ALL ON FUNCTION public.aurea_delivery_digest(bigint,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION aurea_delivery_rpc.issue(p_org uuid,p_week date,p_id uuid,p_address text,p_hash text,p_expires timestamptz) RETURNS TABLE(state text) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM aurea_delivery_rpc.authorize();
 -- Explicitly blocked until legacy session_user guard is adapted and reviewed.
 IF session_user NOT IN ('postgres','aurea_delivery_login') THEN RAISE EXCEPTION 'Delivery transport not enabled' USING ERRCODE='42501'; END IF;
 RETURN QUERY select aurea_private.issue_hmac_invitation(p_org,p_week,p_id,p_address,p_hash,p_expires);
END $$;
REVOKE ALL ON FUNCTION aurea_delivery_rpc.issue(uuid,date,uuid,text,text,timestamptz) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.aurea_delivery_issue(p_org uuid,p_week date,p_id uuid,p_address text,p_hash text,p_expires timestamptz) RETURNS TABLE(state text) LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM aurea_delivery_rpc.issue(p_org,p_week,p_id,p_address,p_hash,p_expires) $$;
REVOKE ALL ON FUNCTION public.aurea_delivery_issue(uuid,date,uuid,text,text,timestamptz) FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
