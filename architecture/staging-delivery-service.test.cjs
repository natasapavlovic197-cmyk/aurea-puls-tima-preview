'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {readDeliveryConfig,createRestrictedDeliveryPool,createInvitationTokenSource,prepareDeliveryServer}=require('./staging-delivery-service.cjs');
const LOGIN='aurea_delivery_login', PROJECT='ublzmoroanhlcgpnxilw';
const env={AUREA_DELIVERY_DB_HOST:'db.'+PROJECT+'.supabase.co',AUREA_DELIVERY_DB_PORT:'5432',AUREA_DELIVERY_DB_USER:LOGIN,AUREA_DELIVERY_DB_NAME:'postgres',AUREA_DELIVERY_DB_PASSWORD:'synthetic-only',AUREA_DELIVERY_DB_CA:'-----BEGIN CERTIFICATE-----\nTEST ONLY\n-----END CERTIFICATE-----',AUREA_INVITATION_HMAC_SECRET:'ab'.repeat(32)};
const U='11111111-1111-4111-8111-111111111111',V='22222222-2222-4222-8222-222222222222',W='2026-11-23';
const claim='select id,organization_id,week_start,action,lease_token from aurea_private.claim_weekly_delivery_job($1::uuid)';
function fixture(overrides={},fail=false){
 const calls=[],releases=[];
 const row={login_user:LOGIN,active_user:LOGIN,bypassrls:false,superuser:false,createrole:false,createdb:false,tls:true,...overrides};
 const pool={async connect(){calls.push('connect');return {async query(sql,params){calls.push(sql);if(sql.startsWith('select session_user'))return {rows:[row]};if(sql===claim){assert.deepEqual(params,[U]);if(fail)throw Error('sensitive provider detail');return {rows:[]}}return {rows:[]}},release(v){releases.push(v)}}}};
 return {pool,calls,releases};
}
test('strict TLS and project-bound identity configuration',()=>{
 const c=readDeliveryConfig(env);assert.equal(c.ssl.rejectUnauthorized,true);assert.equal(c.ssl.servername,env.AUREA_DELIVERY_DB_HOST);
 for(const bad of [{AUREA_DELIVERY_DB_HOST:'db.'+PROJECT+'.supabase.co.evil.example'},{AUREA_DELIVERY_DB_USER:'postgres'},{AUREA_DELIVERY_DB_PORT:'6543'},{AUREA_DELIVERY_DB_CA:''},{AUREA_DELIVERY_DB_PASSWORD:''}])assert.throws(()=>readDeliveryConfig({...env,...bad}));
 const p=readDeliveryConfig({...env,AUREA_DELIVERY_DB_HOST:'aws-0-eu-central-1.pooler.supabase.com',AUREA_DELIVERY_DB_USER:LOGIN+'.'+PROJECT});assert.equal(p.ssl.rejectUnauthorized,true);
});
test('scope-bound tokens deterministic, distinct and hashes compatible with store',()=>{
 const s=createInvitationTokenSource(env.AUREA_INVITATION_HMAC_SECRET),scope={organizationId:U,invitationId:V,weekStart:W},token=s.resolveInvitationToken(scope);
 assert.match(token,/^[a-f0-9]{64}$/);assert.equal(s.resolveInvitationToken(scope),token);assert.equal(s.hashForIssuance(scope),require('node:crypto').createHash('sha256').update(token).digest('hex'));
 for(const delta of [{organizationId:V},{invitationId:U},{weekStart:'2026-11-30'}])assert.notEqual(s.resolveInvitationToken({...scope,...delta}),token);
 assert.throws(()=>s.resolveInvitationToken({...scope,weekStart:'2026-11-24'}));assert.throws(()=>createInvitationTokenSource('0'.repeat(64)));
});
test('only approved parameterized SQL executes after identity check',async()=>{
 const f=fixture(),q=createRestrictedDeliveryPool(f);for(const [sql,p] of [['select * from aurea_private.response_answers',[]],[claim+';select 1',[U]],[claim,['bad']]])await assert.rejects(q.query(sql,p));
 assert.deepEqual(f.calls,[]);assert.deepEqual(await q.query(claim,[U]),{rows:[]});assert.equal(f.calls[1],'BEGIN');assert.equal(f.calls[3],claim);assert.equal(f.calls[4],'COMMIT');assert.deepEqual(f.releases,[undefined]);
});
test('wrong identity or unencrypted connection rolls back and discards',async()=>{
 for(const bad of [{login_user:'postgres'},{active_user:'postgres'},{bypassrls:true},{superuser:true},{createrole:true},{createdb:true},{tls:false}]){
  const f=fixture(bad);await assert.rejects(createRestrictedDeliveryPool(f).query(claim,[U]));assert.equal(f.calls.includes(claim),false);assert.equal(f.calls.at(-1),'ROLLBACK');assert.deepEqual(f.releases,[true]);
 }
});
test('query failure sanitized and connection discarded',async()=>{
 const f=fixture({},true);await assert.rejects(createRestrictedDeliveryPool(f).query(claim,[U]),{message:'Delivery database operation failed'});assert.equal(f.calls.at(-1),'ROLLBACK');assert.deepEqual(f.releases,[true]);
});
test('server cannot activate and disabled worker never touches database or provider',async()=>{
 let opened=0,closed=0;class Pool{constructor(){opened++}async connect(){throw Error('unexpected DB access')}async end(){closed++}}
 const opts={env,Pool,provider:{async send(){throw Error('unexpected send')}},origin:'https://example.invalid'};
 for(const key of ['AUREA_DELIVERY_ENABLED','AUREA_DELIVERY_DEPLOY_APPROVED'])assert.throws(()=>prepareDeliveryServer({...opts,env:{...env,[key]:'true'}}));
 assert.equal(opened,0);const s=prepareDeliveryServer(opts);assert.equal((await s.processNext()).status,'disabled');await s.close();assert.equal(closed,1);
});

test('issuer persists only scoped hash and handles idempotent outcomes',async()=>{
 const {createInvitationIssuer}=require('./staging-delivery-service.cjs');
 const tokens=createInvitationTokenSource(env.AUREA_INVITATION_HMAC_SECRET);
 const scope={organizationId:U,weekStart:W,invitationId:V},input={...scope,email:' QA@example.invalid ',expiresAt:'2026-11-29T12:00:00.000Z'};
 let calls=0;
 const issuer=createInvitationIssuer({tokens,pool:{async query(sql,p){
  assert.equal(sql,'select aurea_private.issue_hmac_invitation($1::uuid,$2::date,$3::uuid,$4::text,$5::text,$6::timestamptz) as state');
  assert.deepEqual(p,[U,W,V,'qa@example.invalid',tokens.hashForIssuance(scope),input.expiresAt]);
  assert.ok(!p.includes(tokens.resolveInvitationToken(scope)));
  return {rows:[{state:['created','existing','conflict'][calls++]}]};
 }}});
 for(const state of ['created','existing','conflict'])assert.deepEqual(await issuer(input),{state,invitationId:V});
 for(const bad of [{email:'bad'},{weekStart:'2026-11-24'},{invitationId:'bad'},{expiresAt:'not-a-date'}])await assert.rejects(issuer({...input,...bad}));
 assert.equal(calls,3);
});
test('issuer SQL passes restricted pool and rejects unexpected results',async()=>{
 const {createInvitationIssuer}=require('./staging-delivery-service.cjs');
 const tokens=createInvitationTokenSource(env.AUREA_INVITATION_HMAC_SECRET);
 let count=0;
 const raw={async connect(){return {async query(sql,p){if(sql.startsWith('select session_user'))return {rows:[{login_user:LOGIN,active_user:LOGIN,bypassrls:false,superuser:false,createrole:false,createdb:false,tls:true}]};if(sql.includes('issue_hmac_invitation')){count++;assert.equal(p.length,6);return {rows:[{state:'created'}]}}return {rows:[]}},release(){}}}};
 const pool=createRestrictedDeliveryPool({pool:raw});
 const input={organizationId:U,weekStart:W,invitationId:V,email:'qa@example.invalid',expiresAt:'2026-11-29T12:00:00.000Z'};
 assert.equal((await createInvitationIssuer({pool,tokens})(input)).state,'created');assert.equal(count,1);
 await assert.rejects(createInvitationIssuer({tokens,pool:{query:async()=>({rows:[{state:'unexpected'}]})}})(input));
});
