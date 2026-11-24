'use strict';
const assert=require('node:assert/strict');
const {randomUUID,randomBytes}=require('node:crypto');
const cfg=require('./postgrest-runtime/staging-public-config.cjs');
const root='https://api.supabase.com/v1/projects/ublzmoroanhlcgpnxilw', pat=process.env.SUPABASE_ACCESS_TOKEN;
const week='2026-11-23';
async function sql(query){const r=await fetch(root+'/database/query',{method:'POST',redirect:'error',signal:AbortSignal.timeout(25000),headers:{authorization:'Bearer '+pat,'content-type':'application/json'},body:JSON.stringify({query})});if(!r.ok)throw Error('SQL HTTP '+r.status);return r.json()}
const {createDeliveryHttpsPool}=require('./postgrest-runtime/delivery-https-pool.cjs');
const {createWeeklyDeliveryStore}=require('./weekly-delivery-store.cjs');
async function main(){
 if(!pat?.startsWith('sbp_fc')||cfg.url!=='https://ublzmoroanhlcgpnxilw.supabase.co'||process.env.GITHUB_REF!=='refs/heads/integration/employee-ten-domains-step5'||process.env.GITHUB_REPOSITORY!=='natasapavlovic197-cmyk/aurea-puls-tima-preview')throw Error('Staging gate');
 const p=await fetch(root,{headers:{authorization:'Bearer '+pat},redirect:'error',signal:AbortSignal.timeout(10000)});if(!p.ok||(await p.json()).name!=='aurea-puls-staging')throw Error('Project gate');
 const ids=[0,1].map(()=>{const u=randomUUID(),o=randomUUID();return {u,o,email:'qa-delivery-'+u+'@example.invalid',name:'SYNTHETIC DELIVERY HTTPS '+o,pw:randomBytes(32).toString('hex'),jwt:null}});
 const [a,b]=ids;
 for(const x of ids)console.log('Synthetic cleanup identifiers: '+x.o+' '+x.u);
 const rpc=(x,name,body)=>fetch(cfg.url+'/rest/v1/rpc/aurea_delivery_'+name,{method:'POST',headers:{apikey:cfg.key,...(x?.jwt?{authorization:'Bearer '+x.jwt}:{}),'content-type':'application/json'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(12000)});
 const denied=async(x,n,body)=>assert.ok([401,403].includes((await rpc(x,n,body)).status),'access denial');
 const claim=()=>({p_lease_token:randomUUID()});
 try{
 await sql('BEGIN;'+ids.map(x=>`
 INSERT INTO auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change,email_change_token_new,email_change_token_current,reauthentication_token,phone_change,phone_change_token)
 VALUES('00000000-0000-0000-0000-000000000000','${x.u}','authenticated','authenticated','${x.email}',extensions.crypt('${x.pw}',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','','','');
 INSERT INTO auth.identities(provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at) VALUES('${x.u}','${x.u}',jsonb_build_object('sub','${x.u}','email','${x.email}','email_verified',true),'email',now(),now(),now());
 INSERT INTO aurea_private.organizations(id,name) VALUES('${x.o}','${x.name}');
 INSERT INTO aurea_private.memberships(organization_id,user_id,role) VALUES('${x.o}','${x.u}','manager');

 INSERT INTO aurea_private.weekly_delivery_jobs(organization_id,week_start,action,next_attempt_at) VALUES('${x.o}','${week}','invite',now()-interval '1 hour');
 `).join('')+`INSERT INTO aurea_delivery_rpc.identities VALUES('${a.u}');INSERT INTO aurea_delivery_rpc.scopes VALUES('${a.u}','${a.o}');COMMIT;`);
 for(const x of ids){const response=await fetch(cfg.url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:cfg.key,'content-type':'application/json'},body:JSON.stringify({email:x.email,password:x.pw}),redirect:'error',signal:AbortSignal.timeout(12000)});assert.equal(response.status,200,'real auth');const session=await response.json();assert.equal(session.user.id,x.u);assert.ok(session.access_token);x.jwt=session.access_token;}
 await denied(null,'claim',claim());await denied(b,'claim',claim());
 const pool=createDeliveryHttpsPool({...cfg,readToken:async()=>a.jwt});
 const store=createWeeklyDeliveryStore({pool});
 const j=await store.claim();assert.equal(j.organizationId,a.o);assert.equal(j.action,'invite');assert.equal(await store.claim(),null);
 const foreign=await sql(`SELECT id::text AS id,status FROM aurea_private.weekly_delivery_jobs WHERE organization_id='${b.o}'`);
 assert.equal(foreign.length,1);assert.equal(foreign[0].status,'pending');
 await denied(a,'finish',{p_id:Number(foreign[0].id),p_lease_token:j.leaseToken,p_success:true});
 await denied(b,'finish',{p_id:j.id,p_lease_token:j.leaseToken,p_success:true});
 assert.equal(await store.complete(j.id,j.leaseToken),true);assert.equal(await store.claim(),null);
 console.log('PASS: real JWT, anonymous and ordinary manager denied, scoped claim, duplicate blocked, foreign job untouched');
 await sql(`DELETE FROM aurea_delivery_rpc.identities WHERE user_id='${a.u}'`);
 await denied(a,'claim',claim());
 console.log('PASS: revoked identity denied with previously valid JWT');
 }finally{
 for(const x of ids)if(x.jwt){try{await fetch(cfg.url+'/auth/v1/logout?scope=global',{method:'POST',headers:{apikey:cfg.key,authorization:'Bearer '+x.jwt},redirect:'error',signal:AbortSignal.timeout(8000)})}catch{}}
 await sql('BEGIN;'+ids.map(x=>`
 DELETE FROM aurea_delivery_rpc.identities WHERE user_id='${x.u}';
 DELETE FROM aurea_private.weekly_delivery_jobs WHERE organization_id='${x.o}' AND EXISTS(SELECT 1 FROM aurea_private.organizations WHERE id='${x.o}' AND name='${x.name}');
 DELETE FROM aurea_private.memberships WHERE organization_id='${x.o}' AND user_id='${x.u}';
 DELETE FROM aurea_private.organizations WHERE id='${x.o}' AND name='${x.name}';
 DELETE FROM auth.users WHERE id='${x.u}' AND email='${x.email}';
 `).join('')+'COMMIT;');
 for(const x of ids){const rows=await sql(`SELECT (SELECT count(*)::int FROM auth.users WHERE id='${x.u}') users,(SELECT count(*)::int FROM auth.sessions WHERE user_id='${x.u}') sessions,(SELECT count(*)::int FROM aurea_private.organizations WHERE id='${x.o}') organizations,(SELECT count(*)::int FROM aurea_private.weekly_delivery_jobs WHERE organization_id='${x.o}') jobs,(SELECT count(*)::int FROM aurea_delivery_rpc.identities WHERE user_id='${x.u}') identities,(SELECT count(*)::int FROM aurea_delivery_rpc.scopes WHERE user_id='${x.u}') scopes`);assert.deepEqual(rows,[{users:0,sessions:0,organizations:0,jobs:0,identities:0,scopes:0}]);}
 console.log('PASS: synthetic users, sessions, companies, jobs and delivery permissions removed');
 }
}
main().catch(e=>{console.error('Delivery E2E failed: '+(e instanceof assert.AssertionError?'assertion '+e.message.split('\n')[0].slice(0,80): /^SQL HTTP \d+$/.test(e.message)?e.message:'execution error'));process.exitCode=1});
