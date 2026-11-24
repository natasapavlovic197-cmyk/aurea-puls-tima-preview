'use strict';
const assert=require('node:assert/strict');
const {randomUUID,randomBytes}=require('node:crypto');
const cfg=require('./postgrest-runtime/staging-public-config.cjs');
const root='https://api.supabase.com/v1/projects/ublzmoroanhlcgpnxilw', pat=process.env.SUPABASE_ACCESS_TOKEN;
const week=new Date(Date.now()-((new Date().getUTCDay()+6)%7)*86400000).toISOString().slice(0,10);
async function sql(query){const r=await fetch(root+'/database/query',{method:'POST',redirect:'error',signal:AbortSignal.timeout(25000),headers:{authorization:'Bearer '+pat,'content-type':'application/json'},body:JSON.stringify({query})});if(!r.ok)throw Error('SQL HTTP '+r.status);return r.json()}
const {createDeliveryHttpsPool}=require('./postgrest-runtime/delivery-https-pool.cjs');
const {createInvitationIssuer,createInvitationTokenSource}=require('./staging-delivery-service.cjs');
const {createEmployeeClient}=require('./employee-live-client.cjs');
const {createPostgrestTransport}=require('./postgrest-runtime/browser-transport.cjs');
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
 const admin=async(expr)=>sql("SELECT set_config('request.jwt.claims',jsonb_build_object('sub','"+a.u+"','role','authenticated','session_id',(SELECT id FROM auth.sessions WHERE user_id='"+a.u+"' ORDER BY created_at DESC LIMIT 1))::text,true); "+expr+";");
 await sql("INSERT INTO aurea_delivery_rpc.active_recipients(organization_id,email) SELECT '"+a.o+"','qa-'||i||'-"+a.o+"@example.invalid' FROM generate_series(1,6) i");
 // Management SQL only advances the private test clock; all delivery operations use actual HTTPS.
 console.log('STEP: prepare roster');
 const prep=await admin("SELECT * FROM aurea_delivery_rpc.prepare_monday('"+mon+"'::timestamptz)");
 assert.equal(prep.length,6);
 console.log('STEP: issue HMAC');
 for(const x of prep){const args={organizationId:x.organization_id,weekStart:String(x.week_start).slice(0,10),invitationId:x.invitation_id,email:x.email,expiresAt:new Date(x.expires_at).toISOString()};assert.equal((await issue(args)).state,'created');assert.equal((await issue(args)).state,'existing');}
 console.log('STEP: initialize worker');
 const messages=[];
 const processNext=createDeliveryPipeline({pool,resolveInvitationToken:tokens.resolveInvitationToken,provider:{async send(m){assert.ok(m.to.endsWith('@example.invalid'));messages.push(m);return {accepted:true,id:'synthetic-'+randomUUID()}}},origin:'https://example.invalid',enabled:true});
 await admin("SELECT * FROM aurea_delivery_rpc.schedule_at('"+mon+"'::timestamptz)");
 assert.equal((await processNext()).status,'delivered');assert.equal(messages.length,6);
 console.log('PASS: real HMAC issuance and six synthetic invitation receipts');
 const c=(await sql("SELECT id FROM aurea_private.cycles WHERE organization_id='"+a.o+"' AND week_start='"+week+"'"))[0].id;
 const transport=createPostgrestTransport(cfg);
 const manager=async(method='GET',body)=>transport('/api/manager-workspace?organization_id='+a.o,{method,headers:{authorization:'Bearer '+a.jwt},...(body?{body:JSON.stringify(body)}:{})});
 const before=await manager();assert.equal(before.status,200);assert.equal((await before.json()).report.history.length,0);
 for(const [i,m] of messages.slice(0,5).entries()){
 const token=m.text.match(/#([a-f0-9]{64})/)[1];
 const client=createEmployeeClient({token,fetchImpl:transport});
 const loaded=await client.load();
 const questions=loaded.questions||loaded;
 assert.equal(questions.length,6);
 assert.equal(await client.submit(Object.fromEntries(questions.map((q,j)=>[q.code,j===5&&i===0?6:4]))),true);
 }
 console.log('PASS: delivered invitation links consumed by real employee client; five responses submitted');
 const open=await manager();assert.equal(open.status,200);assert.equal((await open.json()).report.history.length,0);
 await admin("SELECT * FROM aurea_delivery_rpc.schedule_at('"+mon+"'::timestamptz+interval '2 days')");
 assert.equal((await processNext()).status,'delivered');assert.equal(messages.length,7);assert.match(messages[6].subject,/podsetnik/);
 console.log('PASS: only one nonrespondent reminder');
 await admin("SELECT * FROM aurea_delivery_rpc.schedule_at('"+mon+"'::timestamptz+interval '4 days')");
 assert.equal((await processNext()).status,'delivered');assert.equal(messages.length,8);
 const digest=(await sql("SELECT digest FROM aurea_private.weekly_report_digests WHERE organization_id='"+a.o+"' AND week_start='"+week+"'"))[0].digest;
 assert.equal(digest.domains.flatMap(d=>d.items).length,5);assert.ok(digest.domains.flatMap(d=>d.items).every(i=>i.favorablePercent===100));
 const view=await manager();assert.equal(view.status,200);const data=await view.json();assert.equal(data.report.history.length,5);assert.ok(data.report.history.every(z=>z.responseCount===5&&z.favorablePercent===100));
 assert.deepEqual(new Set(data.report.history.map(z=>z.itemCode)),new Set(digest.domains.flatMap(d=>d.items.map(i=>i.code))));
 const save=await manager('POST',{description:'Synthetic pilot follow-up',cycleId:c,status:'open'});assert.equal(save.status,200);const {id}=await save.json();
 const done=await manager('POST',{description:'Synthetic pilot follow-up',cycleId:c,actionId:id,status:'done'});assert.equal(done.status,200);
 assert.ok((await (await manager()).json()).activities.some(x=>x.id===id&&x.status==='done'));
 console.log('PASS: same-company employee responses flow to privacy-thresholded digest and manager workspace, activity completed');
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
 DELETE FROM aurea_private.manager_actions WHERE organization_id='${x.o}';
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
main().catch(e=>{console.error('Delivery E2E failed: '+(e instanceof assert.AssertionError?'assertion '+e.message.split('\n')[0].slice(0,80): /^SQL HTTP \d+$/.test(e.message)?e.message:(e instanceof TypeError?'TypeError':e instanceof RangeError?'RangeError': /^Delivery HTTPS denied: \d+$/.test(e.message)?e.message:'execution error')));console.error(String(e.stack||'').split('\n').slice(1,5).map(x=>x.replace(/[^\x20-\x7e]/g,'')).join('\n'));process.exitCode=1});
