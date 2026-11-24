'use strict';
const assert=require('node:assert/strict');
const {randomUUID,randomBytes}=require('node:crypto');
const cfg=require('./postgrest-runtime/staging-public-config.cjs');
const root='https://api.supabase.com/v1/projects/ublzmoroanhlcgpnxilw', pat=process.env.SUPABASE_ACCESS_TOKEN;
const week=new Date(Date.now()-((new Date().getUTCDay()+6)%7)*86400000).toISOString().slice(0,10);
async function sql(query){const r=await fetch(root+'/database/query',{method:'POST',redirect:'error',signal:AbortSignal.timeout(25000),headers:{authorization:'Bearer '+pat,'content-type':'application/json'},body:JSON.stringify({query})});if(!r.ok)throw Error('SQL HTTP '+r.status);return r.json()}
const {createDeliveryHttpsPool}=require('./postgrest-runtime/delivery-https-pool.cjs');
const {createInvitationIssuer,createInvitationTokenSource}=require('./staging-delivery-service.cjs');
const {createDeliveryPipeline}=require('./weekly-delivery-pipeline.cjs');
async function main(){
 if(!pat?.startsWith('sbp_fc')||cfg.url!=='https://ublzmoroanhlcgpnxilw.supabase.co'||process.env.GITHUB_REF!=='refs/heads/integration/employee-ten-domains-step5'||process.env.GITHUB_REPOSITORY!=='natasapavlovic197-cmyk/aurea-puls-tima-preview')throw Error('Staging gate');
 const p=await fetch(root,{headers:{authorization:'Bearer '+pat},redirect:'error',signal:AbortSignal.timeout(10000)});if(!p.ok||(await p.json()).name!=='aurea-puls-staging')throw Error('Project gate');
 const ids=[0].map(()=>{const u=randomUUID(),o=randomUUID();return {u,o,email:'qa-delivery-'+u+'@example.invalid',name:'SYNTHETIC DELIVERY HTTPS '+o,pw:randomBytes(32).toString('hex'),jwt:null}});
 const [a]=ids;
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

 `).join('')+`INSERT INTO aurea_delivery_rpc.identities VALUES('${a.u}');INSERT INTO aurea_delivery_rpc.scopes VALUES('${a.u}','${a.o}');COMMIT;`);
 for(const x of ids){const response=await fetch(cfg.url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:cfg.key,'content-type':'application/json'},body:JSON.stringify({email:x.email,password:x.pw}),redirect:'error',signal:AbortSignal.timeout(12000)});assert.equal(response.status,200,'real auth');const session=await response.json();assert.equal(session.user.id,x.u);assert.ok(session.access_token);x.jwt=session.access_token;}
 const pool=createDeliveryHttpsPool({...cfg,readToken:async()=>a.jwt});
 const tokens=createInvitationTokenSource(randomBytes(32).toString('hex'));
 const issue=createInvitationIssuer({pool,tokens});
 const mon=week+' 10:00:00 Europe/Belgrade';
 const admin=async(expr)=>sql("BEGIN; SELECT set_config('request.jwt.claims',jsonb_build_object('sub','"+a.u+"','role','authenticated','session_id',(SELECT id FROM auth.sessions WHERE user_id='"+a.u+"' ORDER BY created_at DESC LIMIT 1))::text,true); "+expr+"; COMMIT;");
 await sql("INSERT INTO aurea_delivery_rpc.active_recipients(organization_id,email) SELECT '"+a.o+"','qa-"+i+"-"+a.o+"@example.invalid' FROM generate_series(1,6) i");
 // Management SQL only advances the private test clock; all delivery operations use actual HTTPS.
 const prep=await admin("SELECT * FROM aurea_delivery_rpc.prepare_monday('"+mon+"'::timestamptz)");
 assert.equal(prep.length,6);
 for(const x of prep){const args={organizationId:x.organization_id,weekStart:x.week_start,invitationId:x.invitation_id,email:x.email,expiresAt:new Date(x.expires_at).toISOString()};assert.equal((await issue(args)).state,'created');assert.equal((await issue(args)).state,'existing');}
 const messages=[];
 const processNext=createDeliveryPipeline({pool,resolveInvitationToken:tokens.resolveInvitationToken,provider:{async send(m){assert.ok(m.to.endsWith('@example.invalid'));messages.push(m);return {accepted:true,id:'synthetic-'+randomUUID()}}},origin:'https://example.invalid',enabled:true});
 await admin("SELECT * FROM aurea_delivery_rpc.schedule_at('"+mon+"'::timestamptz)");
 assert.equal((await processNext()).status,'delivered');assert.equal(messages.length,6);
 console.log('PASS: real HMAC issuance and six synthetic invitation receipts');
 const c=(await sql("SELECT id FROM aurea_private.cycles WHERE organization_id='"+a.o+"' AND week_start='"+week+"'"))[0].id;
 await sql("BEGIN; UPDATE aurea_private.invitations SET redeemed_at=now() WHERE cycle_id='"+c+"' AND id IN (SELECT id FROM aurea_private.invitations WHERE cycle_id='"+c+"' ORDER BY id LIMIT 5); INSERT INTO aurea_private.responses(id,cycle_id) SELECT gen_random_uuid(),'"+c+"' FROM generate_series(1,5); INSERT INTO aurea_private.response_answers(response_id,question_id,rating,not_applicable) SELECT r.id,q.question_id,4,false FROM aurea_private.responses r CROSS JOIN aurea_private.cycle_questions q WHERE r.cycle_id='"+c+"' AND q.cycle_id='"+c+"'; COMMIT;");
 await admin("SELECT * FROM aurea_delivery_rpc.schedule_at('"+mon+"'::timestamptz+interval '2 days')");
 assert.equal((await processNext()).status,'delivered');assert.equal(messages.length,7);assert.match(messages[6].subject,/podsetnik/);
 console.log('PASS: only one nonrespondent reminder');
 await admin("SELECT * FROM aurea_delivery_rpc.schedule_at('"+mon+"'::timestamptz+interval '4 days')");
 assert.equal((await processNext()).status,'delivered');assert.equal(messages.length,8);
 const digest=(await sql("SELECT digest FROM aurea_private.weekly_report_digests WHERE organization_id='"+a.o+"' AND week_start='"+week+"'"))[0].digest;
 assert.equal(digest.domains.flatMap(d=>d.items).length,6);assert.ok(digest.domains.flatMap(d=>d.items).every(i=>i.favorablePercent===100));
 console.log('PASS: closed cycle, six aggregated items, synthetic manager report');
 }finally{
 for(const x of ids)if(x.jwt){try{await fetch(cfg.url+'/auth/v1/logout?scope=global',{method:'POST',headers:{apikey:cfg.key,authorization:'Bearer '+x.jwt},redirect:'error',signal:AbortSignal.timeout(8000)})}catch{}}
 await sql('BEGIN;'+ids.map(x=>`
 DELETE FROM aurea_delivery_rpc.identities WHERE user_id='${x.u}';
 DELETE FROM aurea_private.recipient_delivery_receipts WHERE job_id IN (SELECT id FROM aurea_private.weekly_delivery_jobs WHERE organization_id='${x.o}');
 DELETE FROM aurea_private.weekly_report_digests WHERE organization_id='${x.o}';
 DELETE FROM aurea_private.response_answers WHERE response_id IN (SELECT r.id FROM aurea_private.responses r JOIN aurea_private.cycles c ON c.id=r.cycle_id WHERE c.organization_id='${x.o}');
 DELETE FROM aurea_private.responses WHERE cycle_id IN (SELECT id FROM aurea_private.cycles WHERE organization_id='${x.o}');
 DELETE FROM aurea_private.invitations WHERE cycle_id IN (SELECT id FROM aurea_private.cycles WHERE organization_id='${x.o}');
 DELETE FROM aurea_private.cycle_questions WHERE cycle_id IN (SELECT id FROM aurea_private.cycles WHERE organization_id='${x.o}');
 DELETE FROM aurea_private.cycles WHERE organization_id='${x.o}';
 DELETE FROM aurea_delivery_rpc.active_recipients WHERE organization_id='${x.o}';
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
