-- Disposable PostgreSQL only. All synthetic data rolled back.
BEGIN;
DO $qa$
DECLARE a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); g uuid:=gen_random_uuid(); i uuid:=gen_random_uuid(); j uuid:=gen_random_uuid(); deadline timestamptz; q record;
BEGIN
 INSERT INTO aurea_private.organizations(id,name) VALUES(a,'QA paid A'),(b,'QA paid B'),(g,'QA gift');
 INSERT INTO aurea_commercial.accounts(organization_id,seats) VALUES(a,50),(b,5),(g,150);
 BEGIN INSERT INTO aurea_commercial.accounts(organization_id,seats) VALUES(gen_random_uuid(),0); RAISE EXCEPTION 'invalid hard count accepted' USING ERRCODE='XX000'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN INSERT INTO aurea_commercial.invoices(organization_id,seats,plan) VALUES(a,49,'monthly'); RAISE EXCEPTION 'mismatched seats accepted' USING ERRCODE='XX000'; EXCEPTION WHEN raise_exception THEN NULL; END;
 INSERT INTO aurea_commercial.invoices(id,organization_id,seats,plan) VALUES(i,a,50,'monthly'),(j,b,5,'annual');
 IF (SELECT amount_cents FROM aurea_commercial.invoices WHERE id=i)<>15000 OR (SELECT amount_cents FROM aurea_commercial.invoices WHERE id=j)<>46800 THEN RAISE EXCEPTION 'price mismatch'; END IF;
 PERFORM aurea_commercial.grant_complimentary(g);
 IF aurea_commercial.status(g,now()+interval '10 years') IS DISTINCT FROM 'complimentary' THEN RAISE EXCEPTION 'gift expiry'; END IF;
 BEGIN INSERT INTO aurea_commercial.invoices(organization_id,seats,plan) VALUES(g,150,'annual'); RAISE EXCEPTION 'gift invoice accepted' USING ERRCODE='XX000'; EXCEPTION WHEN raise_exception THEN NULL; END;
 BEGIN PERFORM aurea_commercial.configure_renewal(g,'monthly',true); RAISE EXCEPTION 'gift renewal accepted' USING ERRCODE='XX000'; EXCEPTION WHEN raise_exception THEN NULL; END;
 IF EXISTS(SELECT 1 FROM aurea_commercial.renewal_quote(g,now()+interval '10 years')) THEN RAISE EXCEPTION 'gift quote'; END IF;
 PERFORM aurea_commercial.confirm_payment(a,i,'QA-ref-1',15000,'EUR');
 SELECT paid_until INTO deadline FROM aurea_commercial.accounts WHERE organization_id=a;
 BEGIN PERFORM aurea_commercial.confirm_payment(a,i,'QA-ref-1',15000,'EUR'); RAISE EXCEPTION 'duplicate accepted' USING ERRCODE='XX000'; EXCEPTION WHEN raise_exception THEN NULL; END;
 BEGIN PERFORM aurea_commercial.confirm_payment(b,j,'QA-ref-1',46800,'EUR'); RAISE EXCEPTION 'cross invoice duplicate accepted' USING ERRCODE='XX000'; EXCEPTION WHEN unique_violation THEN NULL; END;
 IF (SELECT paid_until FROM aurea_commercial.accounts WHERE organization_id=a) IS DISTINCT FROM deadline OR (SELECT paid_until FROM aurea_commercial.accounts WHERE organization_id=b) IS NOT NULL OR (SELECT count(*) FROM aurea_commercial.payments)<>1 THEN RAISE EXCEPTION 'duplicate altered state'; END IF;
 IF EXISTS(SELECT 1 FROM aurea_commercial.renewal_quote(a,deadline)) THEN RAISE EXCEPTION 'renewal default on'; END IF;
 PERFORM aurea_commercial.configure_renewal(a,'annual',true);
 IF EXISTS(SELECT 1 FROM aurea_commercial.renewal_quote(a,deadline-interval '1 second')) THEN RAISE EXCEPTION 'early renewal'; END IF;
 SELECT * INTO STRICT q FROM aurea_commercial.renewal_quote(a,deadline);
 IF q.amount_cents<>150000 OR q.seats<>50 OR q.plan<>'annual' OR q.charge_performed OR q.organization_id<>a THEN RAISE EXCEPTION 'renewal quote incorrect'; END IF;
 INSERT INTO aurea_commercial.invoices(organization_id,seats,plan) VALUES(a,50,'annual');
 IF EXISTS(SELECT 1 FROM aurea_commercial.renewal_quote(a,deadline)) THEN RAISE EXCEPTION 'duplicate renewal quote with open invoice'; END IF;
 UPDATE aurea_commercial.accounts SET suspended=true WHERE organization_id=g;
 IF aurea_commercial.status(g) IS DISTINCT FROM 'suspended' THEN RAISE EXCEPTION 'suspension precedence'; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles r WHERE r.rolname IN ('anon','authenticated','service_role') AND (has_schema_privilege(r.oid,'aurea_commercial','USAGE') OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='aurea_commercial' AND has_function_privilege(r.oid,p.oid,'EXECUTE')))) THEN RAISE EXCEPTION 'commercial privilege leak'; END IF;
 RAISE NOTICE 'PASS lifecycle: hard count, prices, gift, renewal, duplicate payments, tenant isolation, privileges';
END $qa$;
ROLLBACK;
