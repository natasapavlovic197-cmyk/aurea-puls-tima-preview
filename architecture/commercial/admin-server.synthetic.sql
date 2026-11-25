-- Run exclusively in disposable PostgreSQL.
BEGIN;
CREATE ROLE aurea_admin_qa LOGIN;
GRANT USAGE ON SCHEMA aurea_admin TO aurea_admin_qa;
GRANT EXECUTE ON FUNCTION aurea_admin.register_company(text,integer,text),aurea_admin.list_accounts(),aurea_admin.change_company(uuid,text,jsonb) TO aurea_admin_qa;
-- Explicitly test that a login with grants but without an operator record is denied.
SET SESSION AUTHORIZATION aurea_admin_qa;
DO $$ BEGIN
 BEGIN PERFORM aurea_admin.list_accounts(); RAISE EXCEPTION 'unlisted login allowed' USING ERRCODE='XX000'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET SESSION AUTHORIZATION;
INSERT INTO aurea_admin.operators(principal) VALUES('aurea_admin_qa');
SET SESSION AUTHORIZATION aurea_admin_qa;
DO $qa$
DECLARE a uuid; b uuid; r record;
BEGIN
 a:=aurea_admin.register_company('Synthetic Admin A',50,'annual');
 b:=aurea_admin.register_company('Synthetic Admin B',5,'gift');
 IF a=b THEN RAISE EXCEPTION 'duplicate organization'; END IF;
 PERFORM aurea_admin.change_company(a,'seats','75'::jsonb);
 PERFORM aurea_admin.change_company(a,'renewal','true'::jsonb);
 PERFORM aurea_admin.change_company(a,'suspended','true'::jsonb);
 SELECT * INTO STRICT r FROM aurea_admin.list_accounts() WHERE organization_id=a;
 IF r.seats<>75 OR r.status<>'suspended' OR r.renewal_enabled OR r.plan<>'annual' THEN RAISE EXCEPTION 'state mismatch'; END IF;
 SELECT * INTO STRICT r FROM aurea_admin.list_accounts() WHERE organization_id=b;
 IF r.seats<>5 OR r.status<>'complimentary' OR r.renewal_enabled THEN RAISE EXCEPTION 'tenant contamination'; END IF;
 BEGIN PERFORM aurea_admin.change_company(b,'renewal','true'::jsonb); RAISE EXCEPTION 'gift renewal allowed' USING ERRCODE='XX000'; EXCEPTION WHEN raise_exception THEN NULL; END;
 BEGIN PERFORM aurea_admin.change_company(a,'seats','0'::jsonb); RAISE EXCEPTION 'invalid seats allowed' USING ERRCODE='XX000'; EXCEPTION WHEN raise_exception THEN NULL; END;
 BEGIN PERFORM aurea_admin.change_company(gen_random_uuid(),'seats','10'::jsonb); RAISE EXCEPTION 'unknown company allowed' USING ERRCODE='XX000'; EXCEPTION WHEN no_data_found THEN NULL; END;
 BEGIN PERFORM count(*) FROM aurea_admin.audit; RAISE EXCEPTION 'direct audit read allowed' USING ERRCODE='XX000'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $qa$;
RESET SESSION AUTHORIZATION;
DO $$ BEGIN
 IF (SELECT count(*) FROM aurea_admin.audit)<>5 THEN RAISE EXCEPTION 'audit count mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM aurea_admin.audit WHERE actor<>'aurea_admin_qa') THEN RAISE EXCEPTION 'audit actor mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role') AND has_schema_privilege(oid,'aurea_admin','USAGE')) THEN RAISE EXCEPTION 'schema exposure'; END IF;
END $$;
UPDATE aurea_admin.operators SET enabled=false WHERE principal='aurea_admin_qa';
SET SESSION AUTHORIZATION aurea_admin_qa;
DO $$ BEGIN
 BEGIN PERFORM aurea_admin.register_company('Denied',5,'monthly'); RAISE EXCEPTION 'disabled operator allowed' USING ERRCODE='XX000'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET SESSION AUTHORIZATION;
ROLLBACK;
SELECT 'PASS admin authorization, persistence, audit, isolated company updates, revocation';
