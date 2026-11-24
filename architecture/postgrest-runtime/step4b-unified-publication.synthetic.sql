-- Run ONLY on disposable PostgreSQL fixture after the review migration.
BEGIN;
DO $$ DECLARE n int; f int; BEGIN
 FOR n IN 0..30 LOOP FOR f IN 0..n LOOP
 IF aurea_private.privacy_publishable_v1(n,f,30) IS DISTINCT FROM (n>=5 AND f>=2 AND n-f>=2) THEN RAISE EXCEPTION 'boundary failure'; END IF;
 END LOOP; END LOOP;
 IF aurea_private.privacy_publishable_v1(6,3,5) OR aurea_private.privacy_publishable_v1(NULL,3,8) THEN RAISE EXCEPTION 'invalid denominator'; END IF;
END $$;
DO $$ DECLARE n bigint; f bigint; BEGIN
 SELECT count(rating),count(*) FILTER(WHERE rating BETWEEN 4 AND 5) INTO n,f FROM (VALUES (4),(5),(4),(2),(3),(NULL::int)) v(rating);
 IF n<>5 OR f<>3 OR NOT aurea_private.privacy_publishable_v1(n,f,6) THEN RAISE EXCEPTION 'NA failure'; END IF;
END $$;
-- Synthetic model of one-time seal, including empty publication.
CREATE TEMP TABLE test_seals(org int,week date,PRIMARY KEY(org,week));
CREATE TEMP TABLE test_rows(org int,week date,n int,p int,PRIMARY KEY(org,week));
INSERT INTO test_seals VALUES(1,'2026-11-23'),(2,'2026-11-23');
INSERT INTO test_rows VALUES(1,'2026-11-23',5,60);
WITH new_seal AS (INSERT INTO test_seals VALUES(1,'2026-11-23'),(2,'2026-11-23') ON CONFLICT DO NOTHING RETURNING *)
INSERT INTO test_rows SELECT org,week,8,50 FROM new_seal;
DO $$ BEGIN
 IF (SELECT count(*) FROM test_rows)<>1 OR (SELECT p FROM test_rows WHERE org=1)<>60 THEN RAISE EXCEPTION 'repeat publication failure'; END IF;
END $$;
ROLLBACK;
