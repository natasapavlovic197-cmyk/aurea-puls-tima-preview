from pathlib import Path
import sys
root=Path(sys.argv[1])
def patch(p,a,b):
    s=p.read_text()
    assert s.count(a)==1,(p,a,s.count(a))
    p.write_text(s.replace(a,b))
m=root/'database/micro.review.sql'
r=root/'database/micro.rollback.sql'
anchor="-- Educational access adapter."
scope="""-- Staging-only, private, explicitly scoped, empty/default deny. No production gate replacement.
DO $stage_scope$ BEGIN
 IF to_regprocedure('aurea_admin.require_activation_v1(text)') IS NULL THEN
  CREATE TABLE aurea_admin.education_stage_grants_v1(
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES aurea_private.organizations(id) ON DELETE CASCADE,
    member_role text NOT NULL CHECK(member_role IN ('manager','employee')),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    expires_at timestamptz NOT NULL,
    PRIMARY KEY(user_id,organization_id,member_role),
    CHECK(expires_at>created_at AND expires_at<=created_at+interval '24 hours')
  );
  ALTER TABLE aurea_admin.education_stage_grants_v1 ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON TABLE aurea_admin.education_stage_grants_v1 FROM PUBLIC,anon,authenticated,service_role;
 END IF;
END $stage_scope$;
"""
patch(m,anchor,scope+anchor)
patch(m," -- Fail closed if the production activation gate is absent (including current staging).\n IF to_regprocedure('aurea_admin.require_activation_v1(text)') IS NULL THEN RETURN false; END IF;\n PERFORM aurea_admin.require_activation_v1(CASE WHEN is_manager THEN 'manager' ELSE 'employee' END);",""" -- Production always uses its existing gate; staging requires an explicit expiring test grant.
 IF to_regprocedure('aurea_admin.require_activation_v1(text)') IS NOT NULL THEN
  PERFORM aurea_admin.require_activation_v1(CASE WHEN is_manager THEN 'manager' ELSE 'employee' END);
 ELSE
  IF to_regclass('aurea_admin.education_stage_grants_v1') IS NULL THEN RETURN false; END IF;
  IF NOT EXISTS(SELECT 1 FROM aurea_admin.education_stage_grants_v1 g
   WHERE g.user_id=u AND g.organization_id=p_org
    AND g.member_role=(CASE WHEN is_manager THEN 'manager' ELSE 'employee' END)
    AND g.expires_at>clock_timestamp()) THEN RETURN false; END IF;
 END IF;""")
patch(r,"DROP FUNCTION aurea_admin.education_entitled_v1(uuid);","""DROP FUNCTION aurea_admin.education_entitled_v1(uuid);
DO $stage_rollback$ BEGIN
 IF to_regclass('aurea_admin.education_stage_grants_v1') IS NOT NULL THEN
  IF EXISTS(SELECT 1 FROM aurea_admin.education_stage_grants_v1) THEN RAISE EXCEPTION 'Remove approved staging test grants before rollback'; END IF;
  DROP TABLE aurea_admin.education_stage_grants_v1;
 END IF;
END $stage_rollback$;""")
p=root/'runtime/education-login.cjs'
s=p.read_text()
a=s.index('const config=globalThis.AUREA_PRODUCTION_CONFIG;')
b=s.index('function invalidate()',a)
s=s[:a]+"""const config=globalThis.AUREA_EDUCATION_CONFIG;
const pairs={production:'https://dlibifwlmbfkboerlmqd.supabase.co',staging:'https://ublzmoroanhlcgpnxilw.supabase.co'};
const safe=config?.enabled===true&&Object.hasOwn(pairs,config.environment)&&config.url===pairs[config.environment]&&config.origin===location.origin&&typeof config.key==='string'&&config.key.startsWith('sb_publishable_');
"""+s[b:]
s=s.replace('Produkcijski pristup još nije aktiviran.','Pristup edukaciji još nije aktiviran.')
p.write_text(s)
patch(root/'integration/education.html','../production-config.js','education-config.js')
