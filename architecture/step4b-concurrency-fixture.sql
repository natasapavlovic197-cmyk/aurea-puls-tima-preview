-- Synthetic contract for the live submit lock: FOR UPDATE on cycle before accepting.
CREATE FUNCTION aurea_private.qa_submit_locked(c uuid,r uuid,v smallint) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE st text;
BEGIN
 SELECT state INTO st FROM aurea_private.cycles WHERE id=c FOR UPDATE;
 IF st IS DISTINCT FROM 'open' THEN RETURN false; END IF;
 INSERT INTO aurea_private.responses VALUES(r,c);
 INSERT INTO aurea_private.response_answers VALUES(r,'20000000-0000-0000-0000-000000000001',v,false);
 RETURN true;
END $$;
INSERT INTO aurea_private.cycles VALUES
('00000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000001','2026-12-14','open',2),
('00000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000001','2026-12-21','open',2);
INSERT INTO aurea_private.cycle_questions SELECT id,'20000000-0000-0000-0000-000000000001' FROM aurea_private.cycles WHERE week_start IN ('2026-12-14','2026-12-21');
INSERT INTO aurea_private.invitations SELECT md5(c.id::text||'invite'||i)::uuid,c.id FROM aurea_private.cycles c CROSS JOIN generate_series(1,6)i WHERE week_start IN ('2026-12-14','2026-12-21');
INSERT INTO aurea_private.responses SELECT md5(c.id::text||'response'||i)::uuid,c.id FROM aurea_private.cycles c CROSS JOIN generate_series(1,4)i WHERE week_start IN ('2026-12-14','2026-12-21');
INSERT INTO aurea_private.response_answers SELECT r.id,'20000000-0000-0000-0000-000000000001',CASE WHEN r.id IN (md5(c.id::text||'response1')::uuid,md5(c.id::text||'response2')::uuid) THEN 4 ELSE 2 END,false FROM aurea_private.responses r JOIN aurea_private.cycles c ON c.id=r.cycle_id WHERE c.week_start IN ('2026-12-14','2026-12-21');
