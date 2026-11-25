-- Candidate: install after billing.review.sql and existing Auth admin migrations.
BEGIN;
CREATE TABLE aurea_billing.bank_evidence (
 invoice_id uuid PRIMARY KEY REFERENCES aurea_billing.receipts(invoice_id),
 operator_id uuid NOT NULL, statement_ref text NOT NULL CHECK(length(btrim(statement_ref)) BETWEEN 1 AND 180),
 booked_on date NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE aurea_billing.bank_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON aurea_billing.bank_evidence FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION aurea_admin.billing_dispatch(p_action text,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid; inv uuid; result jsonb; outcome text; a aurea_commercial.accounts%ROWTYPE; v_evidence aurea_billing.bank_evidence%ROWTYPE; booked date;
BEGIN
 PERFORM aurea_admin.require_operator();
 IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid payload'; END IF;
 CASE p_action
 WHEN 'billing_issue' THEN
  org:=(p_payload->>'org')::uuid;
  SELECT * INTO STRICT a FROM aurea_commercial.accounts WHERE organization_id=org FOR UPDATE;
  IF a.complimentary OR a.suspended THEN RAISE EXCEPTION 'account ineligible'; END IF;
  inv:=aurea_billing.issue(org,a.renewal_plan,p_payload->>'currency',(p_payload->>'rate')::numeric,(p_payload->>'rate_date')::date,'bank');
  SELECT to_jsonb(o) INTO result FROM aurea_billing.orders o WHERE invoice_id=inv;
  INSERT INTO aurea_admin.audit(actor,organization_id,operation,after_state) VALUES(auth.uid()::text::name,org,'billing_issue',result);
 WHEN 'billing_confirm_bank' THEN
  org:=(p_payload->>'org')::uuid; inv:=(p_payload->>'invoice')::uuid; booked:=(p_payload->>'booked_on')::date;
  IF p_payload->>'statement_ref' IS NULL OR length(btrim(p_payload->>'statement_ref')) NOT BETWEEN 1 AND 180 OR booked IS NULL OR booked>current_date THEN RAISE EXCEPTION 'bank evidence required'; END IF;
  outcome:=aurea_billing.settle(org,inv,'bank',p_payload->>'reference',(p_payload->>'amount_minor')::bigint,p_payload->>'currency');
  IF outcome='settled' THEN
   INSERT INTO aurea_billing.bank_evidence(invoice_id,operator_id,statement_ref,booked_on) VALUES(inv,auth.uid(),btrim(p_payload->>'statement_ref'),booked);
   INSERT INTO aurea_admin.audit(actor,organization_id,operation,after_state) VALUES(auth.uid()::text::name,org,'billing_confirm_bank',jsonb_build_object('invoice',inv,'reference',p_payload->>'reference','booked_on',booked,'amount_minor',p_payload->>'amount_minor','currency',p_payload->>'currency'));
  ELSE
   SELECT * INTO STRICT v_evidence FROM aurea_billing.bank_evidence WHERE invoice_id=inv;
   IF v_evidence.statement_ref IS DISTINCT FROM btrim(p_payload->>'statement_ref') OR v_evidence.booked_on IS DISTINCT FROM booked THEN RAISE EXCEPTION 'evidence mismatch'; END IF;
  END IF;
  result:=jsonb_build_object('status',outcome);
 WHEN 'billing_list' THEN
  org:=(p_payload->>'org')::uuid;
  IF org IS NULL THEN RAISE EXCEPTION 'organization required'; END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC),'[]'::jsonb) INTO result FROM (
   SELECT i.id invoice_id,i.organization_id,i.seats,i.plan,o.currency,o.eur_cents,o.rate,o.rate_date,o.amount_minor,o.method,o.created_at,i.paid_at,i.cancelled_at,r.transaction_ref,r.received_at,b.statement_ref,b.booked_on,b.operator_id
   FROM aurea_commercial.invoices i JOIN aurea_billing.orders o ON o.invoice_id=i.id
   LEFT JOIN aurea_billing.receipts r ON r.invoice_id=i.id LEFT JOIN aurea_billing.bank_evidence b ON b.invoice_id=i.id WHERE i.organization_id=org
  ) x;
 ELSE RAISE EXCEPTION 'invalid action';
 END CASE;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION aurea_admin.billing_dispatch(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION aurea_admin.billing_dispatch(text,jsonb) TO authenticated;
CREATE FUNCTION public.aurea_admin_billing_v1(p_action text,p_payload jsonb) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT aurea_admin.billing_dispatch(p_action,p_payload) $$;
REVOKE ALL ON FUNCTION public.aurea_admin_billing_v1(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.aurea_admin_billing_v1(text,jsonb) TO authenticated;
COMMIT;
