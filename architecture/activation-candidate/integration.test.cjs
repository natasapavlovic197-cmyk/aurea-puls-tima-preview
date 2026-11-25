'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {API,ORIGIN,link}=require('./policy.cjs');
const {execute,budgetFetch}=require('./runtime.cjs');
const {sign,verify,trigger}=require('./background-auth.cjs');
const {createAdminConsole}=require('./admin-console.cjs');
const {renderHeaders}=require('./headers.cjs');
const {createProductionPublicConfig}=require('../postgrest-runtime/production-public-config.cjs');
const {createPostgrestTransport}=require('../postgrest-runtime/production-browser-transport.cjs');
const {createInvitationTokenSource}=require('../staging-delivery-service.cjs');
const {createDeliveryHttpsPool}=require('./https-pool.cjs');
const key=createProductionPublicConfig({environment:'production'}).key;
const id='12345678-1234-4234-8234-123456789abc',worker='12345678-1234-4234-8234-123456789abd',org='12345678-1234-4234-8234-123456789abe',recipient='12345678-1234-4234-8234-123456789abf';
const hmac=crypto.createHash('sha256').update('fixture invitation').digest('hex'),bg=crypto.createHash('sha256').update('fixture background').digest('hex');
const env={AUREA_ENVIRONMENT:'production',AUREA_SUPABASE_URL:API,AUREA_SUPABASE_PUBLISHABLE_KEY:key,AUREA_ACTIVATION_APPROVAL:'approved-production-activation-v1',AUREA_SCHEDULER_AUTH_USER_ID:id,AUREA_SCHEDULER_AUTH_EMAIL:'scheduler@example.invalid',AUREA_SCHEDULER_AUTH_PASSWORD:'fixture-password-not-a-real-secret',AUREA_WORKER_AUTH_USER_ID:worker,AUREA_WORKER_AUTH_EMAIL:'worker@example.invalid',AUREA_WORKER_AUTH_PASSWORD:'fixture-worker-password-not-real',AUREA_INVITATION_HMAC_SECRET:hmac,AUREA_BACKGROUND_HMAC_SECRET:bg,AUREA_RESEND_API_KEY:'re_fixture123456789',AUREA_RESEND_FROM:'pulse@mail.aureapsihoterapija.com'};
const instant=Date.parse('2026-11-23T08:00:00Z'),week='2026-11-23',expiry='2026-11-29T23:00:00.000Z';
const fixtureToken=createInvitationTokenSource(hmac).resolveInvitationToken({organizationId:org,weekStart:week,invitationId:recipient});
function reply(x,status=200){return new Response(status===204?null:JSON.stringify(x),{status,headers:{'content-type':'application/json'}})}
function mock(kind,{uncertain=false,friday=false}={}){
 const calls=[];let lease;
 const who=kind==='scheduler'?id:worker;
 const fetchImpl=async(url,o={})=>{
  const b=o.body?JSON.parse(o.body):null;
  if(url===API+'/auth/v1/token?grant_type=password'){calls.push('sign-in');assert.equal(b.email,kind==='scheduler'?env.AUREA_SCHEDULER_AUTH_EMAIL:env.AUREA_WORKER_AUTH_EMAIL);return reply({access_token:'aaa.bbb.ccc',refresh_token:'fixture-refresh',user:{id:who,is_anonymous:false},token_type:'bearer',expires_in:3600});}
  if(url===API+'/auth/v1/user'){calls.push('get-user');return reply({id:who,is_anonymous:false});}
  if(url===API+'/auth/v1/logout?scope=local'){calls.push('logout');return reply(null,204);}
  if(url==='https://api.resend.com/emails'){calls.push('provider');assert.equal(kind,'delivery');assert.ok(b.text.includes(link('employee',fixtureToken)));assert.ok(/^[a-f0-9]{64}$/.test(o.headers['Idempotency-Key']));if(uncertain)throw Error('mock uncertain');return reply({id:'provider-fixture-id'});}
  assert.ok(url.startsWith(API+'/rest/v1/rpc/aurea_delivery_'));const op=url.split('aurea_delivery_').pop();calls.push(op);assert.equal(o.headers.authorization,'Bearer aaa.bbb.ccc');
  switch(op){
   case 'prepare_current':return reply([{organization_id:org,week_start:week,invitation_id:recipient,email:'employee@example.invalid',expires_at:expiry}]);
   case 'issue':assert.equal(b.p_hash,crypto.createHash('sha256').update(fixtureToken).digest('hex'));return reply([{state:'created'}]);
   case 'schedule_due':return reply([{action:friday?'report':'invite',queued:1,not_ready:0}]);
   case 'claim':lease=b.p_lease_token;return reply([{id:1,organization_id:org,week_start:week,action:'invite',lease_token:lease}]);
   case 'snapshot':assert.equal(b.p_lease,lease);return reply([{snapshot:{cycleClosed:false,recipients:[{id:recipient,email:'employee@example.invalid',tokenHash:crypto.createHash('sha256').update(fixtureToken).digest('hex'),expiresAt:expiry,sentAt:null,reminderAt:null,redeemedAt:null}]}}]);
   case 'reserve':return reply([{state:'reserved'}]);
   case 'receipt':assert.equal(b.p_confirm,!uncertain);assert.equal(b.p_provider,uncertain?null:'provider-fixture-id');return reply([{finished:true}]);
   case 'finish':assert.equal(b.p_success,!uncertain);return reply([{finished:true}]);
   default:throw Error('Unexpected RPC '+op);
  }
 };
 return {calls,fetchImpl};
}
test('scheduler authenticates dedicated role, issues scoped HMAC then queues and logs out; Friday queues report only',async()=>{
 const m=mock('scheduler');const e={...env,AUREA_ENABLE_SCHEDULER:'true'};assert.deepEqual(await execute('scheduler',{env:e,fetchImpl:m.fetchImpl,clock:()=>instant}),{status:'queued',action:'invite',queued:1,notReady:0});assert.deepEqual(m.calls,['sign-in','get-user','prepare_current','issue','schedule_due','logout']);
 const f=mock('scheduler',{friday:true});assert.equal((await execute('scheduler',{env:e,fetchImpl:f.fetchImpl,clock:()=>Date.parse('2026-11-27T08:00:00Z')})).action,'report');assert.deepEqual(f.calls,['sign-in','get-user','schedule_due','logout']);
});
test('worker claims, verifies hash, reserves, calls mock provider, confirms receipt and releases; uncertain outcome is not retried',async()=>{
 for(const uncertain of [false,true]){const m=mock('delivery',{uncertain});const result=await execute('delivery',{env:{...env,AUREA_ENABLE_DELIVERY:'true'},fetchImpl:m.fetchImpl,clock:()=>instant});assert.equal(result.status,uncertain?'failed':'delivered');assert.deepEqual(m.calls,['sign-in','get-user','claim','snapshot','reserve','provider','receipt','finish','logout']);}
});
test('runtime off and role isolation before network; server budget and signed dispatch',async()=>{
 let n=0;const fail=async()=>{n++;throw Error('Unexpected network')};assert.deepEqual(await execute('delivery',{env,fetchImpl:fail}),{status:'disabled'});assert.equal(n,0);
 const e={...env,AUREA_ENABLE_SCHEDULER:'true'};const p=createDeliveryHttpsPool({url:API,key,role:'scheduler',env:e,readToken:async()=>{throw Error('Token should not be read')},fetchImpl:fail});
 await assert.rejects(()=>p.query('select id,organization_id,week_start,action,lease_token from aurea_private.claim_weekly_delivery_job($1::uuid)',[id]),/Unapproved/);
 assert.throws(()=>budgetFetch(fail,instant,()=>instant)('https://example.invalid'),/budget/);
 const stamp=String(instant),sig=sign('scheduler',stamp,bg);assert.equal(verify('scheduler',stamp,sig,e,instant),true);assert.equal(verify('delivery',stamp,sig,e,instant),false);assert.equal(verify('scheduler',stamp,sig,e,instant+61000),false);
 assert.deepEqual(await trigger('scheduler',e,async(u,o)=>{assert.equal(u,ORIGIN+'/.netlify/functions/aurea-job-background');assert.equal(o.headers['x-aurea-signature'],sig);return reply(null,202)},()=>instant),{status:'accepted_not_completed'});
});
test('browser configuration has independently gated manager and employee transport and rejects cross-role access',async()=>{
 const cfg=createProductionPublicConfig({environment:'production',employee:true});
 assert.throws(()=>createPostgrestTransport({...cfg,role:'manager'}));let calls=0;
 const f=async(u,o)=>{calls++;assert.equal(u,API+'/rest/v1/rpc/aurea_employee_pulse_v2');assert.equal(JSON.parse(o.body).p_token,fixtureToken);return reply({status:'ready',questions:Array.from({length:6},(_,i)=>({code:'Q'+i,wording:'fixture',position:i}))});};
 const t=createPostgrestTransport({...cfg,role:'employee',fetchImpl:f});await assert.rejects(()=>t('/api/manager-workspace?organization_id='+org,{method:'GET'}),/Unexpected/);assert.equal(calls,0);assert.equal((await t('/api/employee/invitation',{method:'POST',body:JSON.stringify({token:fixtureToken})})).status,200);assert.equal(calls,1);
});
test('MFA console requires AAL2 before API and never persists session',async()=>{
 let level='aal1',calls=0;const ok=data=>({data,error:null});const client={auth:{signInWithPassword:async()=>ok({}),mfa:{getAuthenticatorAssuranceLevel:async()=>ok({currentLevel:level}),listFactors:async()=>ok({totp:[{id:'factor',status:'verified'}]}),challengeAndVerify:async()=>{level='aal2';return ok({})}},getSession:async()=>ok({session:{access_token:'aaa.bbb.ccc'}}),signOut:async()=>ok({})}};
 const c=createAdminConsole({key,endpoint:ORIGIN+'/.netlify/functions/aurea-admin',createClient:(u,k,o)=>{assert.equal(o.auth.persistSession,false);return client},fetchImpl:async()=>{calls++;return reply([])}});
 assert.deepEqual(await c.signIn('operator@example.invalid','fixture'),{status:'challenge',factorId:'factor'});await assert.rejects(()=>c.call('list'),/MFA/);await c.verify('factor','123456');assert.deepEqual(await c.call('list'),[]);assert.equal(calls,1);await c.signOut();
});
test('review SQL has 14 protected entry functions, exact rollback definitions, privacy seal guard and default deny; not executed',()=>{
 const sql=fs.readFileSync(path.join(__dirname,'activation-gates.review.sql'),'utf8'),rb=fs.readFileSync(path.join(__dirname,'activation-gates.rollback.sql'),'utf8'),rows=JSON.parse(fs.readFileSync(path.join(__dirname,'db-baseline-functions.json'),'utf8'));
 assert.equal(rows.length,14);assert.equal((sql.match(/PERFORM aurea_admin.require_activation_v1\(/g)||[]).length,14);
 for(const r of rows){assert.ok(rb.includes(r.definition.trim()+';'));assert.ok(sql.includes('CREATE OR REPLACE FUNCTION '+r.nspname+'.'+r.proname+'('));}
 assert.ok(sql.includes("enabled boolean NOT NULL DEFAULT false"));assert.ok(sql.includes("auth.jwt()->>'aal' IS DISTINCT FROM 'aal2'"));assert.ok(sql.includes("role text NOT NULL UNIQUE CHECK (role IN ('scheduler','delivery'))"));assert.ok(sql.includes("r.role=p_role"));assert.equal((sql.match(/EXISTS\(SELECT 1 FROM aurea_private.privacy_cycle_seals_v1 z/g)||[]).length,2);assert.ok(!sql.includes('ALTER TABLE aurea_private.cycles'));assert.ok(!sql.includes('UPDATE aurea_private.responses'));
});
test('headers match exact production routes and retain restrictive demo policy',()=>{
 const h=renderHeaders({manager:true,employee:false});assert.ok(h.includes("/*\n  X-Robots-Tag"));assert.ok(h.includes("/rukovodilac/*\n  Content-Security-Policy: connect-src 'none'"));assert.ok(h.includes('/puls-app/rukovodilac/*\n  Content-Security-Policy: connect-src '+API));assert.ok(h.includes("/puls-app/zaposleni/*\n  Content-Security-Policy: connect-src 'none'"));assert.equal(h.split(API).length,3);
});
