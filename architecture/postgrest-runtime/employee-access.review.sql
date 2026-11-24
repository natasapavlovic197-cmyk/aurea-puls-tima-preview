-- REVIEW ONLY. Apply only after explicit staging approval, in one transaction.
-- Existing public employee functions remain inaccessible to anon/authenticated.
BEGIN;
DO $guard$
BEGIN
 IF pg_catalog.to_regnamespace('aurea_rpc_private') IS NOT NULL OR pg_catalog.to_regprocedure('public.aurea_employee_pulse_v2(text,text,jsonb)') IS NOT NULL THEN
  RAISE EXCEPTION 'RPC migration already exists or conflicts';
 END IF;
 IF pg_catalog.has_function_privilege('anon','public.aurea_employee_invitation(text)','EXECUTE')
 OR pg_catalog.has_function_privilege('anon','public.aurea_employee_submit(text,jsonb)','EXECUTE')
 OR pg_catalog.has_function_privilege('authenticated','public.aurea_employee_invitation(text)','EXECUTE')
 OR pg_catalog.has_function_privilege('authenticated','public.aurea_employee_submit(text,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Legacy grant conflict'; END IF;
END $guard$;
CREATE SCHEMA aurea_rpc_private;
REVOKE ALL ON SCHEMA aurea_rpc_private FROM PUBLIC,anon,authenticated,service_role;
-- Dedicated bounded counter table, separate from existing limiter and historical data.
CREATE TABLE aurea_rpc_private.employee_limits (
 bucket text NOT NULL CHECK (bucket ~ '^[a-f0-9]{64}$'),
 window_start timestamptz NOT NULL,
 hits integer NOT NULL CHECK (hits BETWEEN 1 AND 300),
 PRIMARY KEY(bucket,window_start)
);
ALTER TABLE aurea_rpc_private.employee_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE aurea_rpc_private.employee_limits FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION aurea_rpc_private.employee_limit(p_bucket text,p_window timestamptz,p_max integer)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $f$
DECLARE v_hits integer;
BEGIN
 INSERT INTO aurea_rpc_private.employee_limits AS l(bucket,window_start,hits)
 VALUES(p_bucket,p_window,1)
 ON CONFLICT(bucket,window_start) DO UPDATE SET hits=l.hits+1 WHERE l.hits<p_max
 RETURNING hits INTO v_hits;
 RETURN coalesce(v_hits<=p_max,false);
END $f$;
REVOKE ALL ON FUNCTION aurea_rpc_private.employee_limit(text,timestamptz,integer) FROM PUBLIC,anon,authenticated,service_role;
-- Private capability boundary. Definer owns only fixed, reviewed operations here;
-- no dynamic SQL, no caller-selected table, tenant or counter limit.
CREATE FUNCTION aurea_rpc_private.employee_pulse_v2(p_action text,p_token text,p_answers jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE v_hash text; v_window timestamptz; v_ready jsonb; v_limit integer; v_result jsonb;
BEGIN
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
END $f$;
REVOKE ALL ON FUNCTION aurea_rpc_private.employee_pulse_v2(text,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
-- Public entrypoint is SECURITY INVOKER; private definer is not in exposed schema.
CREATE FUNCTION public.aurea_employee_pulse_v2(p_action text,p_token text,p_answers jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $f$
 SELECT aurea_rpc_private.employee_pulse_v2(p_action,p_token,p_answers)
$f$;
REVOKE ALL ON FUNCTION public.aurea_employee_pulse_v2(text,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA aurea_rpc_private TO anon;
GRANT EXECUTE ON FUNCTION aurea_rpc_private.employee_pulse_v2(text,text,jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.aurea_employee_pulse_v2(text,text,jsonb) TO anon;
-- Ensure no anonymous access to table or old functions.
DO $guard$
BEGIN
 IF pg_catalog.has_table_privilege('anon','aurea_rpc_private.employee_limits','SELECT,INSERT,UPDATE,DELETE') OR pg_catalog.has_function_privilege('anon','aurea_rpc_private.employee_limit(text,timestamptz,integer)','EXECUTE') THEN RAISE EXCEPTION 'Unexpected privileges'; END IF;
END $guard$;
NOTIFY pgrst,'reload schema';
COMMIT;
