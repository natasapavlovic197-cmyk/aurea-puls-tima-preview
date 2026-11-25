-- Candidate only. Install after the two verified commercial SQL candidates.
BEGIN;
CREATE SCHEMA aurea_admin;
REVOKE ALL ON SCHEMA aurea_admin FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE aurea_admin.operators (
 principal name PRIMARY KEY, enabled boolean NOT NULL DEFAULT true
);
CREATE TABLE aurea_admin.audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor name NOT NULL, organization_id uuid NOT NULL REFERENCES aurea_private.organizations(id),
 operation text NOT NULL, before_state jsonb, after_state jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE aurea_admin.operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE aurea_admin.audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA aurea_admin FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION aurea_admin.require_operator() RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM aurea_admin.operators WHERE principal=session_user AND enabled)
 THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
END $$;
CREATE FUNCTION aurea_admin.list_accounts() RETURNS TABLE(
 organization_id uuid, name text, seats integer, plan text, status text, renewal_enabled boolean,
 trial_end timestamptz, paid_until timestamptz, suspended boolean)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM aurea_admin.require_operator();
 RETURN QUERY SELECT a.organization_id,o.name,a.seats,CASE WHEN a.complimentary THEN 'gift' ELSE a.renewal_plan END,
 aurea_commercial.status(a.organization_id),a.renewal_enabled,a.trial_end,a.paid_until,a.suspended
 FROM aurea_commercial.accounts a JOIN aurea_private.organizations o ON o.id=a.organization_id ORDER BY o.name,a.organization_id;
END $$;
CREATE FUNCTION aurea_admin.register_company(p_name text,p_seats integer,p_plan text) RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid:=gen_random_uuid();
BEGIN
 PERFORM aurea_admin.require_operator();
 IF p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 120 OR p_seats IS NULL OR p_seats NOT BETWEEN 1 AND 100000 OR p_plan IS NULL OR p_plan NOT IN ('monthly','annual','gift') THEN RAISE EXCEPTION 'Invalid company'; END IF;
 INSERT INTO aurea_private.organizations(id,name) VALUES(org,btrim(p_name));
 INSERT INTO aurea_commercial.accounts(organization_id,seats,renewal_plan) VALUES(org,p_seats,CASE WHEN p_plan='annual' THEN 'annual' ELSE 'monthly' END);
 IF p_plan='gift' THEN PERFORM aurea_commercial.grant_complimentary(org); END IF;
 INSERT INTO aurea_admin.audit(actor,organization_id,operation,after_state)
 SELECT session_user,org,'register',to_jsonb(a) FROM aurea_commercial.accounts a WHERE a.organization_id=org;
 RETURN org;
END $$;
CREATE FUNCTION aurea_admin.change_company(p_org uuid,p_operation text,p_value jsonb) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a aurea_commercial.accounts%ROWTYPE; n integer; p text;
BEGIN
 PERFORM aurea_admin.require_operator();
 SELECT * INTO STRICT a FROM aurea_commercial.accounts WHERE organization_id=p_org FOR UPDATE;
 CASE p_operation
 WHEN 'seats' THEN
  IF jsonb_typeof(p_value) IS DISTINCT FROM 'number' OR (p_value#>>'{}') !~ '^[0-9]{1,6}$' THEN RAISE EXCEPTION 'Invalid seat count'; END IF;
  n:=(p_value#>>'{}')::integer;
  IF n NOT BETWEEN 1 AND 100000 OR EXISTS(SELECT 1 FROM aurea_commercial.invoices WHERE organization_id=p_org AND paid_at IS NULL AND cancelled_at IS NULL) THEN RAISE EXCEPTION 'Seat change requires invoice reconciliation'; END IF;
  UPDATE aurea_commercial.accounts SET seats=n WHERE organization_id=p_org;
 WHEN 'plan' THEN
  IF jsonb_typeof(p_value) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Invalid plan'; END IF;
  p:=p_value#>>'{}';
  IF p='gift' THEN PERFORM aurea_commercial.grant_complimentary(p_org);
  ELSIF p IN ('monthly','annual') AND NOT a.complimentary THEN
   PERFORM aurea_commercial.configure_renewal(p_org,p,a.renewal_enabled);
  ELSE RAISE EXCEPTION 'Invalid plan transition'; END IF;
 WHEN 'renewal' THEN
  IF jsonb_typeof(p_value) IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Invalid renewal'; END IF;
  PERFORM aurea_commercial.configure_renewal(p_org,a.renewal_plan,(p_value#>>'{}')::boolean);
 WHEN 'suspended' THEN
  IF jsonb_typeof(p_value) IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Invalid suspension'; END IF;
  UPDATE aurea_commercial.accounts SET suspended=(p_value#>>'{}')::boolean,renewal_enabled=CASE WHEN (p_value#>>'{}')::boolean THEN false ELSE renewal_enabled END WHERE organization_id=p_org;
 ELSE RAISE EXCEPTION 'Invalid operation';
 END CASE;
 INSERT INTO aurea_admin.audit(actor,organization_id,operation,before_state,after_state)
 SELECT session_user,p_org,p_operation,to_jsonb(a),to_jsonb(x) FROM aurea_commercial.accounts x WHERE x.organization_id=p_org;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA aurea_admin FROM PUBLIC,anon,authenticated,service_role;
-- No operator or login provisioned. Separate approval required for grants and deployment.
COMMIT;
