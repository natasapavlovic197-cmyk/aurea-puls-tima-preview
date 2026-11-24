-- Run only in disposable PostgreSQL with candidate installed. No real payments.
BEGIN;
INSERT INTO aurea_private.organizations(id,name) VALUES ('00000000-0000-4000-8000-000000000061','Studio Magnolija QA'),('00000000-0000-4000-8000-000000000062','Second QA');
INSERT INTO aurea_commercial.accounts(organization_id,seats) VALUES ('00000000-0000-4000-8000-000000000061',50),('00000000-0000-4000-8000-000000000062',5);
INSERT INTO aurea_commercial.invoices(id,organization_id,seats,plan) VALUES ('00000000-0000-4000-8000-000000000063','00000000-0000-4000-8000-000000000061',50,'annual'),('00000000-0000-4000-8000-000000000064','00000000-0000-4000-8000-000000000062',5,'monthly');
DO $$
DECLARE a uuid:='00000000-0000-4000-8000-000000000061'; b uuid:='00000000-0000-4000-8000-000000000062'; i uuid:='00000000-0000-4000-8000-000000000063';
BEGIN
 IF (SELECT amount_cents FROM aurea_commercial.invoices WHERE id=i)<>150000 THEN RAISE EXCEPTION 'annual calculation'; END IF;
 IF (SELECT amount_cents FROM aurea_commercial.invoices WHERE organization_id=b)<>3900 THEN RAISE EXCEPTION 'minimum calculation'; END IF;
 IF aurea_commercial.status(a) <> 'trial' THEN RAISE EXCEPTION 'trial'; END IF;
 IF aurea_commercial.status(a,now()+interval '31 days') <> 'expired' THEN RAISE EXCEPTION 'expiry'; END IF;
 BEGIN PERFORM aurea_commercial.confirm_payment(b,i,'QA-wrong-tenant',150000,'EUR'); RAISE EXCEPTION 'unexpected success'; EXCEPTION WHEN no_data_found THEN NULL; END;
 BEGIN PERFORM aurea_commercial.confirm_payment(a,i,'QA-wrong-amount',1,'EUR'); RAISE EXCEPTION 'unexpected success' USING ERRCODE='XX000'; EXCEPTION WHEN raise_exception THEN NULL; END;
 BEGIN PERFORM aurea_commercial.confirm_payment(a,i,'QA-wrong-currency',150000,'USD'); RAISE EXCEPTION 'unexpected success' USING ERRCODE='XX000'; EXCEPTION WHEN raise_exception THEN NULL; END;
 PERFORM aurea_commercial.confirm_payment(a,i,'SIM-2026-001',150000,'EUR');
 IF aurea_commercial.status(a)<>'active' OR (SELECT count(*) FROM aurea_commercial.payments WHERE invoice_id=i)<>1 THEN RAISE EXCEPTION 'payment activation'; END IF;
 BEGIN PERFORM aurea_commercial.confirm_payment(a,i,'SIM-2026-001',150000,'EUR'); RAISE EXCEPTION 'unexpected success' USING ERRCODE='XX000'; EXCEPTION WHEN raise_exception THEN NULL; END;
 IF aurea_commercial.status(b)<>'trial' THEN RAISE EXCEPTION 'tenant contamination'; END IF;
 IF has_schema_privilege('authenticated','aurea_commercial','USAGE') OR has_schema_privilege('anon','aurea_commercial','USAGE') OR has_schema_privilege('service_role','aurea_commercial','USAGE') THEN RAISE EXCEPTION 'schema exposed'; END IF;
 RAISE NOTICE 'PASS commercial candidate assertions';
END $$;
ROLLBACK;
