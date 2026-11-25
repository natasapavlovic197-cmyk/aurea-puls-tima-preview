-- REVIEW ONLY. Apply after step6-candidate.sql in disposable PostgreSQL first.
-- No live charges, no organization activation, no production authorization.
BEGIN;
ALTER TABLE aurea_commercial.accounts
 ADD COLUMN complimentary boolean NOT NULL DEFAULT false,
 ADD COLUMN renewal_enabled boolean NOT NULL DEFAULT false,
 ADD COLUMN renewal_plan text NOT NULL DEFAULT 'monthly' CHECK(renewal_plan IN ('monthly','annual')),
 ADD CONSTRAINT commercial_gift_no_renewal CHECK(NOT complimentary OR NOT renewal_enabled);

CREATE OR REPLACE FUNCTION aurea_commercial.status(p_org uuid,p_at timestamptz DEFAULT now())
RETURNS text LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT CASE WHEN suspended THEN 'suspended' WHEN complimentary THEN 'complimentary'
 WHEN paid_until>p_at THEN 'active' WHEN trial_end>p_at THEN 'trial' ELSE 'expired' END
 FROM aurea_commercial.accounts WHERE organization_id=p_org
$$;

-- Explicit organization ID; never infer gift eligibility from a company name.
CREATE FUNCTION aurea_commercial.grant_complimentary(p_org uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a aurea_commercial.accounts%ROWTYPE;
BEGIN
 SELECT * INTO STRICT a FROM aurea_commercial.accounts WHERE organization_id=p_org FOR UPDATE;
 IF a.paid_until IS NOT NULL OR EXISTS(SELECT 1 FROM aurea_commercial.invoices WHERE organization_id=p_org AND cancelled_at IS NULL) THEN
 RAISE EXCEPTION 'existing billing must be reconciled'; END IF;
 UPDATE aurea_commercial.accounts SET complimentary=true,renewal_enabled=false WHERE organization_id=p_org;
END $$;

CREATE FUNCTION aurea_commercial.configure_renewal(p_org uuid,p_plan text,p_enabled boolean) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a aurea_commercial.accounts%ROWTYPE;
BEGIN
 SELECT * INTO STRICT a FROM aurea_commercial.accounts WHERE organization_id=p_org FOR UPDATE;
 IF p_plan IS NULL OR p_plan NOT IN ('monthly','annual') OR p_enabled IS NULL OR (p_enabled AND (a.complimentary OR a.suspended)) THEN
 RAISE EXCEPTION 'renewal not allowed'; END IF;
 UPDATE aurea_commercial.accounts SET renewal_plan=p_plan,renewal_enabled=p_enabled WHERE organization_id=p_org;
END $$;

-- Prevent invoices for complimentary or suspended accounts, including direct inserts.
CREATE FUNCTION aurea_commercial.guard_invoice_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a aurea_commercial.accounts%ROWTYPE;
BEGIN
 SELECT * INTO STRICT a FROM aurea_commercial.accounts WHERE organization_id=NEW.organization_id FOR UPDATE;
 IF a.complimentary OR a.suspended OR NEW.seats<>a.seats OR NEW.paid_at IS NOT NULL THEN
 RAISE EXCEPTION 'invoice rejected'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER commercial_guard_invoice_insert BEFORE INSERT ON aurea_commercial.invoices
 FOR EACH ROW EXECUTE FUNCTION aurea_commercial.guard_invoice_insert();

-- Read-only quotation, not a payment request or automatic debit.
-- No provider, card token, webhook or timer is configured.
CREATE FUNCTION aurea_commercial.renewal_quote(p_org uuid,p_at timestamptz DEFAULT now())
RETURNS TABLE(organization_id uuid,plan text,seats integer,amount_cents bigint,currency text,charge_performed boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT a.organization_id,a.renewal_plan,a.seats,
 CASE WHEN a.renewal_plan='annual' THEN greatest(3900::bigint,a.seats::bigint*250)*12 ELSE greatest(3900::bigint,a.seats::bigint*300) END,
 'EUR'::text,false
 FROM aurea_commercial.accounts a
 WHERE a.organization_id=p_org AND a.renewal_enabled AND NOT a.complimentary AND NOT a.suspended
 AND a.paid_until IS NOT NULL AND a.paid_until<=p_at
 AND NOT EXISTS(SELECT 1 FROM aurea_commercial.invoices i WHERE i.organization_id=a.organization_id AND i.paid_at IS NULL AND i.cancelled_at IS NULL)
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA aurea_commercial FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
