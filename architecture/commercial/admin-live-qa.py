import os, json, urllib.request, urllib.error, subprocess, secrets, uuid
from pathlib import Path
REF="ublzmoroanhlcgpnxilw"
BASE="https://"+REF+".supabase.co"
def request(url,headers,body=None,method=None):
    try:
        with urllib.request.urlopen(urllib.request.Request(url,headers=headers,data=None if body is None else json.dumps(body).encode(),method=method),timeout=20) as r:
            return r.status,json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code,None
def check(ok,label):
    if not ok: raise RuntimeError(label)
    print("PASS "+label,flush=True)
def sql(q):
    env=dict(os.environ,PGPASSWORD=os.environ["SUPABASE_ADMIN_DB_PASSWORD"],PGSSLMODE="verify-full",PGSSLROOTCERT=os.environ["AUREA_QA_CA"],PGCONNECT_TIMEOUT="12",PGAPPNAME="aurea_admin_final_qa")
    p=subprocess.run(["psql","-X","-w","-qAt","-v","ON_ERROR_STOP=1","-h","aws-1-eu-west-1.pooler.supabase.com","-p","5432","-U","postgres."+REF,"-d","postgres"],input=q,text=True,capture_output=True,env=env,timeout=25)
    if p.returncode:
        msg=p.stderr.lower()
        for pattern,label in [("password authentication failed","DB authentication"),("certificate","TLS certificate"),("could not translate","DNS"),("timeout","connection timeout"),("permission denied","SQL permission"),("tenant or user not found","pooler identity")]:
            if pattern in msg: raise RuntimeError(label)
        raise RuntimeError("staging SQL rejected; raw diagnostics withheld")
    return p.stdout.strip()
def main():
    check(bool(os.environ.get("SUPABASE_ADMIN_DB_PASSWORD")),"protected DB credential present")
    check(os.environ.get("GITHUB_REF")=="refs/heads/commercial/step6-isolated" and os.environ.get("GITHUB_REPOSITORY")=="natasapavlovic197-cmyk/aurea-puls-tima-preview","staging branch guard")
    check(sql("BEGIN READ ONLY; SELECT (session_user='postgres' AND current_user='postgres' AND current_database()='postgres' AND current_setting('transaction_read_only')='on' AND to_regclass('aurea_admin.auth_operators') IS NOT NULL)::text; ROLLBACK;")=="true","verified staging database identity")
    pub="sb_publishable_Za18LIyl1qfx2Tlucyj3Xg_CSWRukS6"
    # Use only new synthetic IDs, never the manager or delivery identities.
    nonce=str(uuid.uuid4()); email="aurea-admin-qa-"+nonce+"@example.invalid"; password=secrets.token_urlsafe(48)
    uid=nonce
    print("::add-mask::"+password,flush=True)
    orgname="AUREA ADMIN QA "+nonce
    check(sql("select count(*) from aurea_admin.auth_operators;")=="0","empty operator allowlist")
    # Staging-only synthetic fixture; no email delivery and no service-role key.
    import crypt
    hashed=crypt.crypt(password,crypt.mksalt(crypt.METHOD_BLOWFISH))
    check(bool(hashed and hashed.startswith("$2")),"synthetic password hash generated")
    try:
        sql("begin; insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,is_anonymous,created_at,updated_at,confirmation_token,recovery_token,email_change,email_change_token_new) values ('"+uid+"','00000000-0000-0000-0000-000000000000','authenticated','authenticated','"+email+"','"+hashed+"',now(),'{\"provider\":\"email\",\"providers\":[\"email\"]}'::jsonb,'{}'::jsonb,false,now(),now(),'','','',''); insert into auth.identities(provider_id,user_id,identity_data,provider,created_at,updated_at) values ('"+uid+"','"+uid+"',jsonb_build_object('sub','"+uid+"','email','"+email+"','email_verified',true),'email',now(),now()); commit;")
        status,session=request(BASE+"/auth/v1/token?grant_type=password",{"apikey":pub,"Content-Type":"application/json"},{"email":email,"password":password})
        check(status==200 and isinstance(session,dict) and bool(session.get("access_token")),"real Auth password login HTTP "+str(status))
        jwt=session["access_token"]; print("::add-mask::"+jwt,flush=True)
        headers={"apikey":pub,"Authorization":"Bearer "+jwt,"Content-Type":"application/json"}
        endpoint=BASE+"/functions/v1/aurea-admin-staging"
        status,_=request(endpoint,headers,{"action":"list","payload":{}})
        check(status==403,"nonoperator HTTPS denied HTTP "+str(status))
        # Limit all existing sessions for this synthetic user to the QA window.
        sql("update auth.sessions set not_after=now()+interval '5 minutes' where user_id='"+uid+"'; insert into aurea_admin.auth_operators(user_id,expires_at) values ('"+uid+"',now()+interval '5 minutes');")
        status,rows=request(endpoint,headers,{"action":"list","payload":{}})
        check(status==200 and isinstance(rows,list),"authorized real HTTPS list HTTP "+str(status))
        env={**os.environ,"QA_PUBLIC_KEY":pub,"QA_EMAIL":email,"QA_PASSWORD":password,"QA_ORG":orgname}
        # Do not give the browser process management or DB credentials.
        env.pop("SUPABASE_ACCESS_TOKEN",None);env.pop("SUPABASE_ADMIN_DB_PASSWORD",None)
        subprocess.run(["node","architecture/commercial/admin-live-browser.cjs"],env=env,check=True,timeout=100)
        check(sql("select count(*) from aurea_admin.audit a join aurea_private.organizations o on o.id=a.organization_id where o.name='"+orgname+"' and a.actor='"+uid+"';")=="2","browser audit identity and two mutations")
        sql("update aurea_admin.auth_operators set enabled=false where user_id='"+uid+"';")
        status,_=request(endpoint,headers,{"action":"list","payload":{}})
        check(status==403,"disabled operator HTTPS denied")
    finally:
        # Exact run-owned identities only; never delete by an unverified identifier.
        sql("begin; delete from aurea_admin.auth_operators where user_id='"+uid+"'; delete from auth.sessions where user_id='"+uid+"'; delete from aurea_admin.audit a using aurea_private.organizations o where a.organization_id=o.id and o.name='"+orgname+"' and a.actor='"+uid+"'; delete from aurea_commercial.accounts a using aurea_private.organizations o where a.organization_id=o.id and o.name='"+orgname+"' and not exists(select 1 from aurea_commercial.invoices i where i.organization_id=o.id); delete from aurea_private.organizations where name='"+orgname+"' and not exists(select 1 from aurea_commercial.accounts a where a.organization_id=organizations.id); delete from auth.identities where user_id='"+uid+"'; delete from auth.users where id='"+uid+"' and email='"+email+"'; commit;")
        check(sql("select (select count(*) from auth.users where id='"+uid+"')+(select count(*) from aurea_admin.auth_operators where user_id='"+uid+"')+(select count(*) from aurea_private.organizations where name='"+orgname+"');")=="0","synthetic cleanup")
if __name__=="__main__":
    try: main()
    except Exception as e:
        print("FAIL "+str(e) if isinstance(e,RuntimeError) else "FAIL staging QA or browser execution",flush=True)
        raise SystemExit(1)
