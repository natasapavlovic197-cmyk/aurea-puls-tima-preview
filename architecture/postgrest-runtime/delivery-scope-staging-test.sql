-- Run only on staging AFTER approved migration. Transaction rollback; no email.
BEGIN;
DO $$
DECLARE u uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); l uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); j bigint; got uuid;
BEGIN
 INSERT INTO auth.users(id,aud,role,email) VALUES(u,'authenticated','authenticated','qa-delivery-'||u||'@example.invalid');
 INSERT INTO auth.sessions(id,user_id) VALUES(s,u);
 INSERT INTO aurea_private.organizations(id,name) VALUES(a,'SYNTHETIC DELIVERY '||a),(b,'SYNTHETIC DELIVERY '||b);
 INSERT INTO aurea_delivery_rpc.identities VALUES(u);
 INSERT INTO aurea_delivery_rpc.scopes VALUES(u,a);
 INSERT INTO aurea_private.weekly_delivery_jobs(organization_id,week_start,action,next_attempt_at) VALUES(b,date '2026-11-23','invite',now()-interval '2 hours'),(a,date '2026-11-23','invite',now()-interval '1 hour');
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','session_id',s)::text,true);
 SELECT id,organization_id INTO j,got FROM public.aurea_delivery_claim(l);
 IF got IS DISTINCT FROM a THEN RAISE EXCEPTION 'Scoped claim failed'; END IF;
 IF EXISTS(SELECT 1 FROM public.aurea_delivery_claim(gen_random_uuid())) THEN RAISE EXCEPTION 'Duplicate or foreign claim'; END IF;
 BEGIN PERFORM aurea_delivery_rpc.require_org(b); RAISE EXCEPTION 'Foreign scope allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF NOT (SELECT finished FROM public.aurea_delivery_finish(j,l,true)) THEN RAISE EXCEPTION 'Finish failed'; END IF;
 DELETE FROM aurea_delivery_rpc.identities WHERE user_id=u;
 BEGIN PERFORM public.aurea_delivery_claim(gen_random_uuid()); RAISE EXCEPTION 'Revoked identity allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT 'PASS scoped claim, duplicate blocked, foreign scope denied, revoked identity denied' AS result;
ROLLBACK;
