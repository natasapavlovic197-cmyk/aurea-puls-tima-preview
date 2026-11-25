-- Isolated billing candidate. No live provider or client grants.
BEGIN;
CREATE SCHEMA aurea_billing;
REVOKE ALL ON SCHEMA aurea_billing FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE aurea_billing.orders(
 invoice_id uuid PRIMARY KEY REFERENCES aurea_commercial.invoices(id),
 currency text NOT NULL CHECK(currency IN ('EUR','RSD')),
 eur_cents bigint NOT NULL CHECK(eur_cents>0),
 rate numeric(12,6) NOT NULL CHECK(rate>0),
 rate_date date NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor>0),
 method text NOT NULL CHECK(method IN ('bank','sandbox')),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(currency<>'EUR' OR rate=1),
 CHECK(amount_minor=round(eur_cents*rate))
);
CREATE TABLE aurea_billing.receipts(
 invoice_id uuid PRIMARY KEY REFERENCES aurea_billing.orders(invoice_id),
 method text NOT NULL CHECK(method IN ('bank','sandbox')),
 transaction_ref text NOT NULL CHECK(length(btrim(transaction_ref)) BETWEEN 1 AND 180),
 amount_minor bigint NOT NULL,
 currency text NOT NULL,
 received_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(method,transaction_ref)
);
ALTER TABLE aurea_billing.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE aurea_billing.receipts ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION aurea_billing.issue(p_org uuid,p_plan text,p_currency text,p_rate numeric,p_rate_date date,p_method text) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a aurea_commercial.accounts%ROWTYPE; i aurea_commercial.invoices%ROWTYPE;
BEGIN
 SELECT * INTO STRICT a FROM aurea_commercial.accounts WHERE organization_id=p_org FOR UPDATE;
 IF a.complimentary OR a.suspended OR p_plan IS DISTINCT FROM a.renewal_plan OR p_currency IS NULL OR p_currency NOT IN ('EUR','RSD') OR p_rate IS NULL OR p_rate<=0 OR p_rate>1000 OR p_rate<>round(p_rate,6) OR p_rate_date IS NULL OR p_method IS NULL OR p_method NOT IN ('bank','sandbox') OR (p_currency='EUR' AND p_rate<>1) THEN RAISE EXCEPTION 'invalid order'; END IF;
 INSERT INTO aurea_commercial.invoices(organization_id,seats,plan) VALUES(p_org,a.seats,p_plan) RETURNING * INTO i;
 INSERT INTO aurea_billing.orders(invoice_id,currency,eur_cents,rate,rate_date,amount_minor,method) VALUES(i.id,p_currency,i.amount_cents,p_rate,p_rate_date,round(i.amount_cents*p_rate),p_method);
 RETURN i.id;
END $$;
-- Trusted verifier only. No client, webhook or browser may call directly.
CREATE FUNCTION aurea_billing.settle(p_org uuid,p_invoice uuid,p_method text,p_ref text,p_amount bigint,p_currency text) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a aurea_commercial.accounts%ROWTYPE; o aurea_billing.orders%ROWTYPE; r aurea_billing.receipts%ROWTYPE;
BEGIN
 SELECT * INTO STRICT a FROM aurea_commercial.accounts WHERE organization_id=p_org FOR UPDATE;
 SELECT b.* INTO STRICT o FROM aurea_billing.orders b JOIN aurea_commercial.invoices i ON i.id=b.invoice_id WHERE b.invoice_id=p_invoice AND i.organization_id=p_org FOR UPDATE OF b;
 IF p_method IS DISTINCT FROM o.method OR p_amount IS DISTINCT FROM o.amount_minor OR p_currency IS DISTINCT FROM o.currency OR p_ref IS NULL OR length(btrim(p_ref)) NOT BETWEEN 1 AND 180 THEN RAISE EXCEPTION 'settlement mismatch'; END IF;
 SELECT * INTO r FROM aurea_billing.receipts WHERE invoice_id=p_invoice;
 IF FOUND THEN
  IF r.method=p_method AND r.transaction_ref=btrim(p_ref) AND r.amount_minor=p_amount AND r.currency=p_currency THEN RETURN 'duplicate'; END IF;
  RAISE EXCEPTION 'already settled';
 END IF;
 IF a.complimentary OR a.suspended THEN RAISE EXCEPTION 'account not eligible'; END IF;
 INSERT INTO aurea_billing.receipts(invoice_id,method,transaction_ref,amount_minor,currency) VALUES(p_invoice,p_method,btrim(p_ref),p_amount,p_currency);
 PERFORM aurea_commercial.confirm_payment(p_org,p_invoice,p_method||':'||btrim(p_ref),o.eur_cents,'EUR');
 RETURN 'settled';
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA aurea_billing FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA aurea_billing FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
