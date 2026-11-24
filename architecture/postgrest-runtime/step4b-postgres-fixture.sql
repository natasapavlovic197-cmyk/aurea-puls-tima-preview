-- Disposable CI database only. Minimal schema contract, not a production clone.
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE ROLE aurea_delivery_login;
CREATE SCHEMA aurea_private; CREATE SCHEMA aurea_delivery_rpc; CREATE SCHEMA aurea_manager_rpc; CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('qa.uid',true),'')::uuid $$;
CREATE FUNCTION aurea_manager_rpc.check_session_and_limit() RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Denied' USING ERRCODE='42501'; END IF; END $$;
CREATE FUNCTION aurea_delivery_rpc.require_job(bigint,uuid) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Denied' USING ERRCODE='42501'; END IF; END $$;
CREATE FUNCTION aurea_delivery_rpc.require_org(uuid) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF NOT EXISTS(SELECT 1 FROM aurea_private.memberships WHERE organization_id=$1 AND user_id=auth.uid()) THEN RAISE EXCEPTION 'Denied' USING ERRCODE='42501'; END IF; END $$;
CREATE TABLE aurea_private.cycles(id uuid PRIMARY KEY,organization_id uuid NOT NULL,week_start date NOT NULL,state text NOT NULL,model_version int NOT NULL,UNIQUE(organization_id,week_start));
CREATE TABLE aurea_private.questions(id uuid PRIMARY KEY,code text,domain text,item_version int,model_version int);
CREATE TABLE aurea_private.cycle_questions(cycle_id uuid,question_id uuid,PRIMARY KEY(cycle_id,question_id));
CREATE TABLE aurea_private.responses(id uuid PRIMARY KEY,cycle_id uuid NOT NULL);
CREATE TABLE aurea_private.response_answers(response_id uuid,question_id uuid,rating smallint,not_applicable boolean NOT NULL,PRIMARY KEY(response_id,question_id));
CREATE TABLE aurea_private.invitations(id uuid PRIMARY KEY,cycle_id uuid NOT NULL);
CREATE TABLE aurea_private.memberships(organization_id uuid,user_id uuid,role text);
CREATE TABLE aurea_private.weekly_delivery_jobs(id bigint PRIMARY KEY,organization_id uuid,week_start date,action text,status text,lease_token uuid,lease_expires_at timestamptz);
CREATE TABLE aurea_private.weekly_report_digests(organization_id uuid,week_start date,digest jsonb,PRIMARY KEY(organization_id,week_start));
INSERT INTO aurea_private.cycles VALUES ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','2026-11-16','closed',2);
