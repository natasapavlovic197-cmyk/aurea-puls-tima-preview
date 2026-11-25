BEGIN;
-- Review candidate only. Apply only after explicit owner approval, project verification and rollback evidence.
CREATE TABLE aurea_admin.activation_gates_v1 (
 role text PRIMARY KEY CHECK (role IN ('manager','employee','adminRead','adminWrite','billingWrite','scheduler','delivery')),
 enabled boolean NOT NULL DEFAULT false
);
INSERT INTO aurea_admin.activation_gates_v1(role) VALUES ('manager'),('employee'),('adminRead'),('adminWrite'),('billingWrite'),('scheduler'),('delivery');
ALTER TABLE aurea_admin.activation_gates_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON aurea_admin.activation_gates_v1 FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE aurea_admin.activation_operator_rights_v1 (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 role text NOT NULL CHECK (role IN ('adminRead','adminWrite','billingWrite')),
 expires_at timestamptz NOT NULL,
 PRIMARY KEY(user_id,role)
);
ALTER TABLE aurea_admin.activation_operator_rights_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON aurea_admin.activation_operator_rights_v1 FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION aurea_admin.require_activation_v1(p_role text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $guard$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM aurea_admin.activation_gates_v1 g WHERE g.role=p_role AND g.enabled) THEN
  RAISE EXCEPTION 'Activation denied' USING ERRCODE='42501';
 END IF;
 IF p_role IN ('adminRead','adminWrite','billingWrite') THEN
  PERFORM aurea_admin.require_operator();
  IF auth.jwt()->>'aal' IS DISTINCT FROM 'aal2' OR NOT EXISTS (
   SELECT 1 FROM aurea_admin.activation_operator_rights_v1 r JOIN aurea_admin.auth_operators o ON o.user_id=r.user_id
   WHERE r.user_id=auth.uid() AND r.role=p_role AND r.expires_at>clock_timestamp()
   AND o.enabled AND o.expires_at>clock_timestamp()
  ) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 END IF;
END $guard$;
REVOKE ALL ON FUNCTION aurea_admin.require_activation_v1(text) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION aurea_admin.aurea_admin_dispatch_v1(p_action text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE result jsonb;
BEGIN
 PERFORM aurea_admin.require_activation_v1(CASE WHEN p_action='list' THEN 'adminRead' ELSE 'adminWrite' END);
 PERFORM aurea_admin.require_operator();
 IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid request'; END IF;
 CASE p_action
 WHEN 'list' THEN SELECT coalesce(jsonb_agg(x),'[]'::jsonb) INTO result FROM aurea_admin.list_accounts() x;
 WHEN 'register' THEN result:=jsonb_build_object('id',aurea_admin.register_company(p_payload->>'name',(p_payload->>'seats')::integer,p_payload->>'plan'));
 WHEN 'change' THEN PERFORM aurea_admin.change_company((p_payload->>'id')::uuid,p_payload->>'operation',p_payload->'value'); result:='{"ok":true}'::jsonb;
 ELSE RAISE EXCEPTION 'Invalid action';
 END CASE;
 RETURN result;
END $function$;

CREATE OR REPLACE FUNCTION aurea_admin.billing_dispatch(p_action text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE org uuid; inv uuid; result jsonb; outcome text; a aurea_commercial.accounts%ROWTYPE; v_evidence aurea_billing.bank_evidence%ROWTYPE; booked date;
BEGIN
 PERFORM aurea_admin.require_activation_v1(CASE WHEN p_action='billing_list' THEN 'adminRead' ELSE 'billingWrite' END);
 PERFORM aurea_admin.require_operator();
 IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid payload'; END IF;
 CASE p_action
 WHEN 'billing_issue' THEN
  org:=(p_payload->>'org')::uuid;
  SELECT * INTO STRICT a FROM aurea_commercial.accounts WHERE organization_id=org FOR UPDATE;
  IF a.complimentary OR a.suspended THEN RAISE EXCEPTION 'account ineligible'; END IF;
  inv:=aurea_billing.issue(org,a.renewal_plan,p_payload->>'currency',(p_payload->>'rate')::numeric,(p_payload->>'rate_date')::date,'bank');
  SELECT to_jsonb(o) INTO result FROM aurea_billing.orders o WHERE invoice_id=inv;
  INSERT INTO aurea_admin.audit(actor,organization_id,operation,after_state) VALUES(auth.uid()::text::name,org,'billing_issue',result);
 WHEN 'billing_confirm_bank' THEN
  org:=(p_payload->>'org')::uuid; inv:=(p_payload->>'invoice')::uuid; booked:=(p_payload->>'booked_on')::date;
  IF p_payload->>'statement_ref' IS NULL OR length(btrim(p_payload->>'statement_ref')) NOT BETWEEN 1 AND 180 OR booked IS NULL OR booked>current_date THEN RAISE EXCEPTION 'bank evidence required'; END IF;
  outcome:=aurea_billing.settle(org,inv,'bank',p_payload->>'reference',(p_payload->>'amount_minor')::bigint,p_payload->>'currency');
  IF outcome='settled' THEN
   INSERT INTO aurea_billing.bank_evidence(invoice_id,operator_id,statement_ref,booked_on) VALUES(inv,auth.uid(),btrim(p_payload->>'statement_ref'),booked);
   INSERT INTO aurea_admin.audit(actor,organization_id,operation,after_state) VALUES(auth.uid()::text::name,org,'billing_confirm_bank',jsonb_build_object('invoice',inv,'reference',p_payload->>'reference','booked_on',booked,'amount_minor',p_payload->>'amount_minor','currency',p_payload->>'currency'));
  ELSE
   SELECT * INTO STRICT v_evidence FROM aurea_billing.bank_evidence WHERE invoice_id=inv;
   IF v_evidence.statement_ref IS DISTINCT FROM btrim(p_payload->>'statement_ref') OR v_evidence.booked_on IS DISTINCT FROM booked THEN RAISE EXCEPTION 'evidence mismatch'; END IF;
  END IF;
  result:=jsonb_build_object('status',outcome);
 WHEN 'billing_list' THEN
  org:=(p_payload->>'org')::uuid;
  IF org IS NULL THEN RAISE EXCEPTION 'organization required'; END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC),'[]'::jsonb) INTO result FROM (
   SELECT i.id invoice_id,i.organization_id,i.seats,i.plan,o.currency,o.eur_cents,o.rate,o.rate_date,o.amount_minor,o.method,o.created_at,i.paid_at,i.cancelled_at,r.transaction_ref,r.received_at,b.statement_ref,b.booked_on,b.operator_id
   FROM aurea_commercial.invoices i JOIN aurea_billing.orders o ON o.invoice_id=i.id
   LEFT JOIN aurea_billing.receipts r ON r.invoice_id=i.id LEFT JOIN aurea_billing.bank_evidence b ON b.invoice_id=i.id WHERE i.organization_id=org
  ) x;
 ELSE RAISE EXCEPTION 'invalid action';
 END CASE;
 RETURN result;
END $function$;

CREATE OR REPLACE FUNCTION aurea_delivery_rpc.claim(p_lease_token uuid)
 RETURNS TABLE(id bigint, organization_id uuid, week_start date, action text, lease_token uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 PERFORM aurea_admin.require_activation_v1('delivery');
 PERFORM aurea_delivery_rpc.authorize();
 RETURN QUERY select * from aurea_delivery_rpc.impl_claim_weekly_delivery_job(p_lease_token);
END $function$;

CREATE OR REPLACE FUNCTION aurea_delivery_rpc.digest(p_job bigint, p_lease uuid, p_digest jsonb)
 RETURNS TABLE(finished boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 PERFORM aurea_admin.require_activation_v1('delivery');
 PERFORM aurea_delivery_rpc.authorize();
 RETURN QUERY select aurea_delivery_rpc.impl_persist_weekly_digest(p_job,p_lease,p_digest);
END $function$;

CREATE OR REPLACE FUNCTION aurea_delivery_rpc.finish(p_id bigint, p_lease_token uuid, p_success boolean)
 RETURNS TABLE(finished boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 PERFORM aurea_admin.require_activation_v1('delivery');
 PERFORM aurea_delivery_rpc.authorize();
 RETURN QUERY select aurea_delivery_rpc.impl_finish_weekly_delivery_job(p_id,p_lease_token,p_success);
END $function$;

CREATE OR REPLACE FUNCTION aurea_delivery_rpc.issue(p_org uuid, p_week date, p_id uuid, p_address text, p_hash text, p_expires timestamp with time zone)
 RETURNS TABLE(state text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 PERFORM aurea_admin.require_activation_v1('scheduler');
 PERFORM aurea_delivery_rpc.authorize();
 RETURN QUERY select aurea_delivery_rpc.impl_issue_hmac_invitation(p_org,p_week,p_id,p_address,p_hash,p_expires);
END $function$;

CREATE OR REPLACE FUNCTION aurea_delivery_rpc.prepare_monday(p_now timestamp with time zone)
 RETURNS TABLE(organization_id uuid, week_start date, invitation_id uuid, email text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE w date:=date_trunc('week',p_now AT TIME ZONE 'Europe/Belgrade')::date; o uuid;
BEGIN
 PERFORM aurea_admin.require_activation_v1('scheduler');
 PERFORM aurea_delivery_rpc.authorize();
 IF extract(isodow from p_now AT TIME ZONE 'Europe/Belgrade')<>1 OR extract(hour from p_now AT TIME ZONE 'Europe/Belgrade')<9 THEN RETURN; END IF;
 FOR o IN SELECT s.organization_id FROM aurea_delivery_rpc.scopes s WHERE s.user_id=auth.uid() ORDER BY s.organization_id LOOP
 PERFORM aurea_private.create_weekly_cycle_v2(o,w);
 END LOOP;
 RETURN QUERY SELECT c.organization_id,w,md5(c.id::text||':'||r.id::text)::uuid,r.email,(w+7)::timestamp AT TIME ZONE 'Europe/Belgrade'
 FROM aurea_private.cycles c JOIN aurea_delivery_rpc.active_recipients r ON r.organization_id=c.organization_id AND r.active
 WHERE c.week_start=w AND c.model_version=2 AND c.state='draft' AND aurea_delivery_rpc.allowed_org(c.organization_id);
END $function$;

CREATE OR REPLACE FUNCTION aurea_delivery_rpc.publications(p_job bigint, p_lease uuid, p_org uuid, p_week date)
 RETURNS TABLE(week_start text, item_code text, item_version integer, domain text, response_count integer, favorable_percent double precision, closed boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 PERFORM aurea_admin.require_activation_v1('delivery');
 PERFORM aurea_delivery_rpc.authorize();
 RETURN QUERY select * from aurea_delivery_rpc.impl_delivery_publications(p_job,p_lease,p_org,p_week);
END $function$;

CREATE OR REPLACE FUNCTION aurea_delivery_rpc.receipt(p_job bigint, p_lease uuid, p_key text, p_provider text, p_confirm boolean)
 RETURNS TABLE(finished boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 PERFORM aurea_admin.require_activation_v1('delivery');
 PERFORM aurea_delivery_rpc.authorize();
 RETURN QUERY select aurea_delivery_rpc.impl_finish_recipient_delivery(p_job,p_lease,p_key,p_provider,p_confirm);
END $function$;

CREATE OR REPLACE FUNCTION aurea_delivery_rpc.reserve(p_job bigint, p_lease uuid, p_recipient uuid, p_key text)
 RETURNS TABLE(state text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 PERFORM aurea_admin.require_activation_v1('delivery');
 PERFORM aurea_delivery_rpc.authorize();
 RETURN QUERY select aurea_delivery_rpc.impl_reserve_recipient_delivery(p_job,p_lease,p_recipient,p_key);
END $function$;

CREATE OR REPLACE FUNCTION aurea_delivery_rpc.schedule_at(p_now timestamp with time zone)
 RETURNS TABLE(action text, queued integer, not_ready integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE local_now timestamp:=p_now AT TIME ZONE 'Europe/Belgrade';
 w date:=date_trunc('week',local_now)::date;
 a text; n integer; missing integer;
BEGIN
 PERFORM aurea_admin.require_activation_v1('scheduler');
 PERFORM aurea_delivery_rpc.authorize();
 a:=CASE extract(isodow from local_now) WHEN 1 THEN 'invite' WHEN 3 THEN 'reminder' WHEN 5 THEN 'report' ELSE NULL END;
 IF a IS NULL OR extract(hour from local_now)<9 THEN RETURN; END IF;
 IF a='invite' THEN
 UPDATE aurea_private.cycles c SET state='open' WHERE c.week_start=w AND c.model_version=2 AND c.state='draft' AND aurea_delivery_rpc.allowed_org(c.organization_id)
 AND EXISTS(SELECT 1 FROM aurea_delivery_rpc.active_recipients r WHERE r.organization_id=c.organization_id AND r.active)
 AND NOT EXISTS(SELECT 1 FROM aurea_delivery_rpc.active_recipients r WHERE r.organization_id=c.organization_id AND r.active AND NOT EXISTS(SELECT 1 FROM aurea_private.invitations i WHERE i.cycle_id=c.id AND i.recipient_address=r.email AND i.id=md5(c.id::text||':'||r.id::text)::uuid));
 ELSIF a='report' THEN
 UPDATE aurea_private.cycles c SET state='closed' WHERE c.week_start=w AND c.model_version=2 AND c.state='open' AND aurea_delivery_rpc.allowed_org(c.organization_id);
 END IF;
 INSERT INTO aurea_private.weekly_delivery_jobs(organization_id,week_start,action)
 SELECT c.organization_id,w,a FROM aurea_private.cycles c
 WHERE c.week_start=w AND c.model_version=2 AND aurea_delivery_rpc.allowed_org(c.organization_id)
 AND ((a='report' AND c.state='closed' AND EXISTS(SELECT 1 FROM aurea_private.privacy_cycle_seals_v1 z WHERE z.cycle_id=c.id AND z.organization_id=c.organization_id AND z.week_start=c.week_start)) OR (a IN ('invite','reminder') AND c.state='open'))
 ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS n=ROW_COUNT;
 SELECT count(*)::integer INTO missing FROM aurea_delivery_rpc.scopes s
 WHERE s.user_id=auth.uid() AND NOT EXISTS(SELECT 1 FROM aurea_private.cycles c WHERE c.organization_id=s.organization_id AND c.week_start=w AND c.model_version=2 AND ((a='report' AND c.state='closed' AND EXISTS(SELECT 1 FROM aurea_private.privacy_cycle_seals_v1 z WHERE z.cycle_id=c.id AND z.organization_id=c.organization_id AND z.week_start=c.week_start)) OR (a IN ('invite','reminder') AND c.state='open')));
 RETURN QUERY SELECT a,n,missing;
END $function$;

CREATE OR REPLACE FUNCTION aurea_delivery_rpc.snapshot(p_job bigint, p_lease uuid, p_org uuid, p_week date, p_action text)
 RETURNS TABLE(snapshot jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 PERFORM aurea_admin.require_activation_v1('delivery');
 PERFORM aurea_delivery_rpc.authorize();
 RETURN QUERY select aurea_delivery_rpc.impl_delivery_snapshot(p_job,p_lease,p_org,p_week,p_action);
END $function$;

CREATE OR REPLACE FUNCTION aurea_manager_rpc.check_session_and_limit()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE u uuid := auth.uid(); w timestamptz; h integer;
BEGIN
 PERFORM aurea_admin.require_activation_v1('manager');
 IF u IS NULL OR NOT EXISTS (
 SELECT 1 FROM auth.sessions s JOIN auth.users a ON a.id=s.user_id
 WHERE s.user_id=u AND s.id::text=auth.jwt()->>'session_id'
 AND a.deleted_at IS NULL AND (a.banned_until IS NULL OR a.banned_until<=clock_timestamp())
 AND (s.not_after IS NULL OR s.not_after>clock_timestamp())
 ) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 -- One row per user; no minute-by-minute accumulation.
 IF NOT EXISTS (SELECT 1 FROM aurea_private.memberships m WHERE m.user_id=u AND m.role IN ('owner','manager')) THEN
 RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 w:=to_timestamp(floor(extract(epoch FROM clock_timestamp())/60)*60);
 INSERT INTO aurea_manager_rpc.request_limits AS l(user_id,window_start,hits)
 VALUES(u,w,1) ON CONFLICT(user_id) DO UPDATE SET window_start=GREATEST(l.window_start,EXCLUDED.window_start), hits=CASE WHEN EXCLUDED.window_start>l.window_start THEN 1 ELSE l.hits+1 END WHERE EXCLUDED.window_start>l.window_start OR l.hits<120 RETURNING hits INTO h;
 IF h IS NULL THEN RAISE EXCEPTION 'Request limit reached' USING ERRCODE='PT429'; END IF;
END $function$;

CREATE OR REPLACE FUNCTION aurea_rpc_private.employee_pulse_v2(p_action text, p_token text, p_answers jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_hash text; v_window timestamptz; v_ready jsonb; v_limit integer; v_result jsonb;
BEGIN
 PERFORM aurea_admin.require_activation_v1('employee');
 IF p_action IS NULL OR p_action NOT IN ('invitation','submit') OR p_token IS NULL OR p_token !~ '^[a-f0-9]{64}$' THEN
  RETURN jsonb_build_object('status','unavailable');
 END IF;
 IF p_action='invitation' AND p_answers IS NOT NULL THEN RETURN jsonb_build_object('status','unavailable'); END IF;
 IF p_action='submit' THEN
  IF p_answers IS NULL OR jsonb_typeof(p_answers)<>'array' OR octet_length(p_answers::text)>4096 THEN RETURN jsonb_build_object('status','unavailable'); END IF;
  IF jsonb_array_length(p_answers)<>6 THEN RETURN jsonb_build_object('status','unavailable'); END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_answers) AS a(v)
   WHERE jsonb_typeof(v)<>'object' OR jsonb_typeof(v->'code') IS DISTINCT FROM 'string'
   OR (v->>'code') !~ '^[A-Z_]{1,32}$' OR jsonb_typeof(v->'rating') IS DISTINCT FROM 'number'
   OR (v->>'rating') !~ '^[1-6]$' OR v - 'code' - 'rating' <> '{}'::jsonb)
   THEN RETURN jsonb_build_object('status','unavailable'); END IF;
  IF (SELECT count(DISTINCT v->>'code') FROM jsonb_array_elements(p_answers) AS a(v))<>6 THEN RETURN jsonb_build_object('status','unavailable'); END IF;
 END IF;
 v_window:=to_timestamp(floor(extract(epoch FROM clock_timestamp())/300)*300);
 -- Fixed global buckets before invitation lookup; invalid token guesses cannot create arbitrary buckets.
 IF NOT aurea_rpc_private.employee_limit(encode(sha256(convert_to('aurea-rpc-global:'||p_action,'UTF8')),'hex'),v_window,300) THEN
  RETURN jsonb_build_object('status','try_later');
 END IF;
 v_hash:=encode(sha256(convert_to(p_token,'UTF8')),'hex');
 v_ready:=public.aurea_employee_invitation(v_hash);
 IF v_ready->>'status' IS DISTINCT FROM 'ready' OR jsonb_typeof(v_ready->'questions') IS DISTINCT FROM 'array' THEN RETURN jsonb_build_object('status','unavailable'); END IF;
 IF jsonb_array_length(v_ready->'questions')<>6 THEN RETURN jsonb_build_object('status','unavailable'); END IF;
 v_limit:=CASE WHEN p_action='invitation' THEN 15 ELSE 8 END;
 -- Only known, unexpired invitations get their own bucket. Hash-of-hash is not an invitation credential.
 IF NOT aurea_rpc_private.employee_limit(encode(sha256(convert_to('aurea-rpc-invite:'||p_action||':'||v_hash,'UTF8')),'hex'),v_window,v_limit) THEN
  RETURN jsonb_build_object('status','try_later');
 END IF;
 IF p_action='invitation' THEN RETURN v_ready; END IF;
 -- Existing submit function locks invitation and cycle, validates assigned codes and redeems atomically.
 v_result:=public.aurea_employee_submit(v_hash,p_answers);
 RETURN jsonb_build_object('status',CASE WHEN v_result->>'status'='submitted' THEN 'submitted' ELSE 'unavailable' END);
END $function$;
COMMIT;
