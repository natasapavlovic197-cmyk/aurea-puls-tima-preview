import os, json, urllib.request, urllib.error, subprocess, secrets, uuid
from pathlib import Path
REF="ublzmoroanhlcgpnxilw"
BASE="https://"+REF+".supabase.co"
def request(url,headers,body=None):
    try:
        with urllib.request.urlopen(urllib.request.Request(url,headers=headers,data=None if body is None else json.dumps(body).encode()),timeout=20) as r:
            return r.status,json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code,None
def check(ok,label):
    if not ok: raise RuntimeError(label)
    print("PASS "+label,flush=True)
def sql(q):
    env=dict(os.environ,PGPASSWORD=os.environ["SUPABASE_ADMIN_DB_PASSWORD"],PGSSLMODE="require")
    p=subprocess.run(["psql","-X","-qAt","-v","ON_ERROR_STOP=1","-h","aws-1-eu-west-1.pooler.supabase.com","-p","5432","-U","postgres."+REF,"-d","postgres"],input=q,text=True,capture_output=True,env=env,timeout=25)
    if p.returncode: raise RuntimeError("staging SQL operation rejected")
    return p.stdout.strip()
def main():
    token=os.environ["SUPABASE_ACCESS_TOKEN"]
    check(bool(token and os.environ["SUPABASE_ADMIN_DB_PASSWORD"]),"protected credentials present")
    status,keys=request("https://api.supabase.com/v1/projects/"+REF+"/api-keys",{"Authorization":"Bearer "+token})
    check(status==200 and isinstance(keys,list),"staging key inventory authorized")
    pub=next((x.get("api_key") for x in keys if str(x.get("api_key","")).startswith("sb_publishable_") and not x.get("disabled")),None)
    check(bool(pub),"publishable key available")
    # Use only new synthetic IDs, never the manager or delivery identities.
    uid=str(uuid.uuid4()); email="aurea-admin-qa-"+uid+"@example.invalid"; password=secrets.token_urlsafe(48)
    print("::add-mask::"+password,flush=True)
    orgname="AUREA ADMIN QA "+uid
    check(sql("select count(*) from aurea_admin.auth_operators;")=="0","empty operator allowlist")
    # No Auth administrator key required. Synthetic user is created directly in staging
    # with a bcrypt password; access expires by database session and explicit cleanup.
    try:
        sql("insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,is_anonymous,created_at,updated_at) values ('"+uid+"','00000000-0000-0000-0000-000000000000','authenticated','authenticated','"+email+"',extensions.crypt('"+password+"',extensions.gen_salt('bf')),now(),false,now(),now());")
        status,session=request(BASE+"/auth/v1/token?grant_type=password",{"apikey":pub,"Content-Type":"application/json"},{"email":email,"password":password})
        check(status==200 and bool(session.get("access_token")),"real Auth password login")
        jwt=session["access_token"]; print("::add-mask::"+jwt,flush=True)
        headers={"apikey":pub,"Authorization":"Bearer "+jwt,"Content-Type":"application/json"}
        endpoint=BASE+"/functions/v1/aurea-admin-staging"
        status,_=request(endpoint,headers,{"action":"list","payload":{}})
        check(status==403,"nonoperator HTTPS denied")
        # Limit all existing sessions for this synthetic user to the QA window.
        sql("update auth.sessions set not_after=now()+interval '5 minutes' where user_id='"+uid+"'; insert into aurea_admin.auth_operators(user_id) values ('"+uid+"');")
        status,rows=request(endpoint,headers,{"action":"list","payload":{}})
        check(status==200 and isinstance(rows,list),"authorized real HTTPS list")
        env={**os.environ,"QA_PUBLIC_KEY":pub,"QA_EMAIL":email,"QA_PASSWORD":password,"QA_ORG":orgname}
        # Do not give the browser process management or DB credentials.
        env.pop("SUPABASE_ACCESS_TOKEN",None);env.pop("SUPABASE_ADMIN_DB_PASSWORD",None)
        subprocess.run(["node","architecture/commercial/admin-live-browser.cjs"],env=env,check=True,timeout=100)
        check(sql("select count(*) from aurea_admin.audit a join aurea_private.organizations o on o.id=a.organization_id where o.name='"+orgname+"' and a.actor='"+uid+"';")=="2","browser audit identity and two mutations")
        sql("update aurea_admin.auth_operators set enabled=false where user_id='"+uid+"';")
        status,_=request(endpoint,headers,{"action":"list","payload":{}})
        check(status==403,"disabled operator HTTPS denied")
    finally:
        # Exact run-owned identities only; abort rather than deleting unrelated data.
        sql("begin; delete from aurea_admin.auth_operators where user_id='"+uid+"'; delete from auth.sessions where user_id='"+uid+"'; delete from aurea_admin.audit a using aurea_private.organizations o where a.organization_id=o.id and o.name='"+orgname+"' and a.actor='"+uid+"'; delete from aurea_commercial.accounts a using aurea_private.organizations o where a.organization_id=o.id and o.name='"+orgname+"' and not exists(select 1 from aurea_commercial.invoices i where i.organization_id=o.id); delete from aurea_private.organizations where name='"+orgname+"' and not exists(select 1 from aurea_commercial.accounts a where a.organization_id=organizations.id); delete from auth.users where id='"+uid+"' and email='"+email+"'; commit;")
        check(sql("select (select count(*) from auth.users where id='"+uid+"')+(select count(*) from aurea_admin.auth_operators where user_id='"+uid+"')+(select count(*) from aurea_private.organizations where name='"+orgname+"');")=="0","synthetic cleanup")
if __name__=="__main__":
    try: main()
    except Exception as e:
        print("FAIL "+str(e) if isinstance(e,RuntimeError) else "FAIL staging QA or browser execution",flush=True)
        raise SystemExit(1)
