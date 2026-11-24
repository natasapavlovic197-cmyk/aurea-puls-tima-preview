-- Real staging database, run with migration in same transaction; no provider.
DO $$
DECLARE u uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); o uuid:=gen_random_uuid(); c uuid; rec record; w date:=date_trunc('week',clock_timestamp() AT TIME ZONE 'Europe/Belgrade')::date; mon timestamptz; n integer;
BEGIN
 mon:=(w::timestamp+interval '10 hours') AT TIME ZONE 'Europe/Belgrade';
 INSERT INTO auth.users(id,aud,role,email) VALUES(u,'authenticated','authenticated','qa-cycle-'||u||'@example.invalid');
 INSERT INTO auth.sessions(id,user_id) VALUES(s,u);
 INSERT INTO aurea_private.organizations(id,name) VALUES(o,'SYNTHETIC CYCLE '||o);
 INSERT INTO aurea_delivery_rpc.identities VALUES(u);
 INSERT INTO aurea_delivery_rpc.scopes VALUES(u,o);
 INSERT INTO aurea_delivery_rpc.active_recipients(organization_id,email,active) VALUES(o,'active@example.invalid',true),(o,'inactive@example.invalid',false);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','session_id',s)::text,true);
 SELECT * INTO STRICT rec FROM aurea_delivery_rpc.prepare_monday(mon);
 SELECT id INTO STRICT c FROM aurea_private.cycles WHERE organization_id=o AND week_start=w;
 IF (SELECT count(*) FROM aurea_private.cycle_questions WHERE cycle_id=c)<>6 THEN RAISE EXCEPTION 'Question count'; END IF;
 IF (SELECT queued FROM aurea_delivery_rpc.schedule_at(mon))<>0 THEN RAISE EXCEPTION 'Premature queue'; END IF;
 IF aurea_delivery_rpc.impl_issue_hmac_invitation(o,w,rec.invitation_id,rec.email,repeat('a',64),rec.expires_at)<>'created' THEN RAISE EXCEPTION 'Issue failed'; END IF;
 IF aurea_delivery_rpc.impl_issue_hmac_invitation(o,w,rec.invitation_id,rec.email,repeat('a',64),rec.expires_at)<>'existing' THEN RAISE EXCEPTION 'Retry failed'; END IF;
 IF (SELECT queued FROM aurea_delivery_rpc.schedule_at(mon))<>1 OR (SELECT queued FROM aurea_delivery_rpc.schedule_at(mon))<>0 THEN RAISE EXCEPTION 'Monday queue'; END IF;
 IF (SELECT queued FROM aurea_delivery_rpc.schedule_at(mon+interval '2 days'))<>1 THEN RAISE EXCEPTION 'Wednesday queue'; END IF;
 IF (SELECT queued FROM aurea_delivery_rpc.schedule_at(mon+interval '4 days'))<>1 THEN RAISE EXCEPTION 'Friday queue'; END IF;
 IF (SELECT state FROM aurea_private.cycles WHERE id=c)<>'closed' THEN RAISE EXCEPTION 'Closure failed'; END IF;
 IF (SELECT count(*) FROM aurea_private.invitations WHERE cycle_id=c)<>1 THEN RAISE EXCEPTION 'Recipient count'; END IF;
END $$;
SELECT 'PASS six questions, active roster, issuance retry, Monday Wednesday Friday queue, closure' AS result;
