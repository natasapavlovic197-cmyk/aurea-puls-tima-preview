-- Synthetic fixture only. JWT claims set by PostgREST signature verification.
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb) $$;
CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD 'qa-only-no-real-credential';
GRANT anon,authenticated TO authenticator;
GRANT USAGE ON SCHEMA public TO anon,authenticated;
INSERT INTO aurea_private.organizations(id,name) VALUES('00000000-0000-4000-8000-000000000011','Synthetic Micro'),('00000000-0000-4000-8000-000000000012','Synthetic other');
INSERT INTO aurea_commercial.accounts(organization_id,seats) VALUES('00000000-0000-4000-8000-000000000011',2),('00000000-0000-4000-8000-000000000012',1);
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES('00000000-0000-4000-8000-000000000021','qa-employee@example.invalid',now()),('00000000-0000-4000-8000-000000000022','qa-manager@example.invalid',now());
INSERT INTO auth.sessions(id,user_id) VALUES('00000000-0000-4000-8000-000000000031','00000000-0000-4000-8000-000000000021'),('00000000-0000-4000-8000-000000000032','00000000-0000-4000-8000-000000000022');
INSERT INTO aurea_delivery_rpc.active_recipients(organization_id,email) VALUES('00000000-0000-4000-8000-000000000011','qa-employee@example.invalid');
INSERT INTO aurea_private.memberships(organization_id,user_id,role) VALUES('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000022','owner');
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM aurea_admin.education_stage_grants_v1) OR has_table_privilege('authenticated','aurea_admin.education_stage_grants_v1','SELECT,INSERT,UPDATE,DELETE') OR has_table_privilege('anon','aurea_admin.education_stage_grants_v1','SELECT,INSERT,UPDATE,DELETE') THEN RAISE EXCEPTION 'Stage gate not private/default deny';END IF;
END $$;
