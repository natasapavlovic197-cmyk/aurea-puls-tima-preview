BEGIN;
DO $$
DECLARE a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); g uuid:=gen_random_uuid(); i uuid; j uuid; t timestamptz; x text;
BEGIN
 INSERT INTO aurea_private.organizations(id,name) VALUES(a,'Billing synthetic A'),(b,'Billing synthetic B'),(g,'Billing synthetic gift');
 INSERT INTO aurea_commercial.accounts(organization_id,seats,renewal_plan) VALUES(a,50,'monthly'),(b,5,'annual'),(g,5,'monthly');
 PERFORM aurea_commercial.grant_complimentary(g);
 i:=aurea_billing.issue(a,'monthly','RSD',117.2,current_date,'bank');
 j:=aurea_billing.issue(b,'annual','EUR',1,current_date,'sandbox');
 IF (SELECT amount_minor FROM aurea_billing.orders WHERE invoice_id=i)<>1758000 THEN RAISE EXCEPTION 'RSD mismatch'; END IF;
 IF (SELECT amount_minor FROM aurea_billing.orders WHERE invoice_id=j)<>46800 THEN RAISE EXCEPTION 'annual minimum mismatch'; END IF;
 BEGIN PERFORM aurea_billing.issue(g,'monthly','EUR',1,current_date,'bank'); RAISE EXCEPTION 'gift invoice allowed' USING ERRCODE='XX000'; EXCEPTION WHEN raise_exception THEN NULL; END;
 BEGIN PERFORM aurea_billing.settle(a,i,'bank','a',1758000,'EUR'); RAISE EXCEPTION 'wrong currency accepted' USING ERRCODE='XX000'; EXCEPTION WHEN raise_exception THEN NULL; END;
 BEGIN PERFORM aurea_billing.settle(a,i,'bank','a',1757999,'RSD'); RAISE EXCEPTION 'wrong amount accepted' USING ERRCODE='XX000'; EXCEPTION WHEN raise_exception THEN NULL; END;
 BEGIN PERFORM aurea_billing.settle(b,i,'bank','a',1758000,'RSD'); RAISE EXCEPTION 'cross tenant accepted' USING ERRCODE='XX000'; EXCEPTION WHEN no_data_found THEN NULL; END;
 IF aurea_billing.settle(a,i,'bank','a',1758000,'RSD')<>'settled' THEN RAISE EXCEPTION 'bank settlement'; END IF;
 SELECT paid_until INTO t FROM aurea_commercial.accounts WHERE organization_id=a;
 IF aurea_billing.settle(a,i,'bank','a',1758000,'RSD')<>'duplicate' THEN RAISE EXCEPTION 'duplicate'; END IF;
 IF (SELECT paid_until FROM aurea_commercial.accounts WHERE organization_id=a) IS DISTINCT FROM t THEN RAISE EXCEPTION 'double extension'; END IF;
 IF aurea_billing.settle(b,j,'sandbox','b',46800,'EUR')<>'settled' THEN RAISE EXCEPTION 'sandbox settlement'; END IF;
 IF (SELECT count(*) FROM aurea_billing.receipts)<>2 THEN RAISE EXCEPTION 'ledger count'; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role') AND has_schema_privilege(oid,'aurea_billing','USAGE')) THEN RAISE EXCEPTION 'privilege leak'; END IF;
END $$;
ROLLBACK;
SELECT 'PASS billing currency, minimum, gift, tenant isolation, settlement and duplicate protection';
