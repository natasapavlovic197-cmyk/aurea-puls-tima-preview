-- Candidate only; apply after approval. PostgreSQL 17.
BEGIN;
CREATE SCHEMA aurea_commercial;
REVOKE ALL ON SCHEMA aurea_commercial FROM PUBLIC, anon, authenticated, service_role;
CREATE TABLE aurea_commercial.accounts (
 organization_id uuid PRIMARY KEY REFERENCES aurea_private.organizations(id) ON DELETE RESTRICT,
 seats integer NOT NULL CHECK(seats BETWEEN 1 AND 100000),
 trial_start timestamptz NOT NULL DEFAULT now(),
 trial_end timestamptz NOT NULL DEFAULT (now() + interval '720 hours'),
 CHECK(trial_end = trial_start + interval '720 hours'),
 paid_until timestamptz, suspended boolean NOT NULL DEFAULT false
);
CREATE TABLE aurea_commercial.invoices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES aurea_commercial.accounts(organization_id),
 seats integer NOT NULL CHECK(seats BETWEEN 1 AND 100000),
 plan text NOT NULL CHECK(plan IN ('monthly','annual')),
 amount_cents bigint GENERATED ALWAYS AS (CASE WHEN plan='annual' THEN greatest(3900::bigint,seats::bigint*250)*12 ELSE greatest(3900::bigint,seats::bigint*300) END) STORED,
 currency text NOT NULL DEFAULT 'EUR' CHECK(currency='EUR'),
 created_at timestamptz NOT NULL DEFAULT now(),
 paid_at timestamptz, cancelled_at timestamptz,
 CHECK(paid_at IS NULL OR cancelled_at IS NULL)
);
CREATE UNIQUE INDEX commercial_one_open_invoice ON aurea_commercial.invoices(organization_id) WHERE paid_at IS NULL AND cancelled_at IS NULL;
CREATE TABLE aurea_commercial.payments (
 reference text PRIMARY KEY CHECK(length(trim(reference)) BETWEEN 1 AND 200),
 invoice_id uuid NOT NULL UNIQUE REFERENCES aurea_commercial.invoices(id),
 amount_cents bigint NOT NULL CHECK(amount_cents>0),
 currency text NOT NULL CHECK(currency='EUR'),
 received_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE aurea_commercial.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE aurea_commercial.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE aurea_commercial.payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA aurea_commercial FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION aurea_commercial.status(p_org uuid,p_at timestamptz DEFAULT now()) RETURNS text LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT CASE WHEN suspended THEN 'suspended' WHEN paid_until>p_at THEN 'active' WHEN trial_end>p_at THEN 'trial' ELSE 'expired' END FROM aurea_commercial.accounts WHERE organization_id=p_org
$$;
CREATE FUNCTION aurea_commercial.confirm_payment(p_org uuid,p_invoice uuid,p_ref text,p_amount bigint,p_currency text) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a aurea_commercial.accounts%ROWTYPE; i aurea_commercial.invoices%ROWTYPE; t timestamptz := now();
BEGIN
 SELECT * INTO STRICT a FROM aurea_commercial.accounts WHERE organization_id=p_org FOR UPDATE;
 SELECT * INTO STRICT i FROM aurea_commercial.invoices WHERE id=p_invoice AND organization_id=p_org FOR UPDATE;
 IF a.suspended OR i.paid_at IS NOT NULL OR i.cancelled_at IS NOT NULL OR i.seats<>a.seats OR p_amount IS DISTINCT FROM i.amount_cents OR p_currency IS DISTINCT FROM i.currency THEN RAISE EXCEPTION 'payment rejected'; END IF;
 INSERT INTO aurea_commercial.payments(reference,invoice_id,amount_cents,currency) VALUES(trim(p_ref),i.id,p_amount,p_currency);
 UPDATE aurea_commercial.invoices SET paid_at=t WHERE id=i.id;
 UPDATE aurea_commercial.accounts SET paid_until=greatest(t,trial_end,coalesce(paid_until,t)) + CASE WHEN i.plan='annual' THEN interval '12 months' ELSE interval '1 month' END WHERE organization_id=p_org;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA aurea_commercial FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
