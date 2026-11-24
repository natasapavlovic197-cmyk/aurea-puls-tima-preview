-- Real migration functions exercised against disposable fixture.
INSERT INTO aurea_private.cycles VALUES
('00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','2026-11-23','open',2),
('00000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','2026-11-23','open',2),
('00000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000002','2026-11-30','closed',2);
INSERT INTO aurea_private.questions VALUES ('20000000-0000-0000-0000-000000000001','A_WORKLOAD','workload',1,2),('20000000-0000-0000-0000-000000000002','A_CLARITY','role_clarity',1,2);
INSERT INTO aurea_private.cycle_questions SELECT '00000000-0000-0000-0000-000000000002',id FROM aurea_private.questions;
INSERT INTO aurea_private.invitations SELECT md5('invite'||i)::uuid,'00000000-0000-0000-0000-000000000002' FROM generate_series(1,6)i;
INSERT INTO aurea_private.responses SELECT md5('response'||i)::uuid,'00000000-0000-0000-0000-000000000002' FROM generate_series(1,6)i;
INSERT INTO aurea_private.response_answers SELECT md5('response'||i)::uuid,'20000000-0000-0000-0000-000000000001',CASE WHEN i=6 THEN NULL WHEN i<=3 THEN 4 ELSE 2 END,i=6 FROM generate_series(1,6)i;
INSERT INTO aurea_private.response_answers SELECT md5('response'||i)::uuid,'20000000-0000-0000-0000-000000000002',5,false FROM generate_series(1,6)i;
UPDATE aurea_private.cycles SET state='closed' WHERE state='open';
DO $$ BEGIN
 IF (SELECT count(*) FROM aurea_private.privacy_cycle_seals_v1)<>3 THEN RAISE EXCEPTION 'seal count'; END IF;
 IF (SELECT count(*) FROM aurea_private.privacy_publications_v1)<>1 THEN RAISE EXCEPTION 'suppression'; END IF;
 IF NOT EXISTS(SELECT 1 FROM aurea_private.privacy_publications_v1 WHERE response_count=5 AND favorable_percent=60) THEN RAISE EXCEPTION 'NA denominator'; END IF;
 IF EXISTS(SELECT 1 FROM aurea_private.privacy_cycle_seals_v1 WHERE week_start='2026-11-16') THEN RAISE EXCEPTION 'historical backfill'; END IF;
END $$;
UPDATE aurea_private.response_answers SET rating=2 WHERE rating=4;
UPDATE aurea_private.cycles SET state='closed' WHERE state='closed';
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM aurea_private.privacy_publications_v1 WHERE favorable_percent=60) THEN RAISE EXCEPTION 'mutable publication'; END IF; END $$;
INSERT INTO aurea_private.memberships VALUES ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','manager');
SELECT set_config('qa.uid','30000000-0000-0000-0000-000000000001',false);
DO $$ BEGIN
 IF (SELECT count(*) FROM aurea_private.manager_publications_v2('10000000-0000-0000-0000-000000000001'))<>1 THEN RAISE EXCEPTION 'manager read'; END IF;
 BEGIN PERFORM aurea_private.manager_publications_v2('10000000-0000-0000-0000-000000000002'); RAISE EXCEPTION 'cross tenant allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF (SELECT count(*) FROM aurea_private.pulse_summary('10000000-0000-0000-0000-000000000001',5))<>1 THEN RAISE EXCEPTION 'legacy read'; END IF;
 IF has_table_privilege('authenticated','aurea_private.privacy_publications_v1','SELECT') OR has_table_privilege('anon','aurea_private.privacy_cycle_seals_v1','SELECT') THEN RAISE EXCEPTION 'table exposure'; END IF;
END $$;
BEGIN;
INSERT INTO aurea_private.cycles VALUES ('00000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','2026-11-30','closed',2);
ROLLBACK;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM aurea_private.privacy_cycle_seals_v1 WHERE cycle_id='00000000-0000-0000-0000-000000000005') THEN RAISE EXCEPTION 'rollback seal'; END IF; END $$;
SELECT 'PASS actual trigger, empty seals, NA, extremes, repeat, history, manager scope, table ACL, transactional rollback';
