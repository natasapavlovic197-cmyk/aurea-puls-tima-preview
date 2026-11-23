'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {createDeliveryPipeline}=require('./weekly-delivery-pipeline.cjs');
const ORG='11111111-1111-4111-8111-111111111111', RID='22222222-2222-4222-8222-222222222222', WEEK='2026-11-23', TOKEN='a'.repeat(64), HASH=createHash('sha256').update(TOKEN).digest('hex');
function fixture(action='invite'){
 let state=null,lease,sendCount=0,providerFails=false,wrongToken=false,wrongScope=false;
 const events=[];
 const pool={async query(sql,p){
  if(sql.includes('claim_weekly_delivery_job')){lease=p[0];return {rows:[{id:'12',organization_id:ORG,week_start:WEEK,action,lease_token:lease}]}}
  assert.equal(p[0],12);assert.equal(p[1],lease);
  if(sql.includes('delivery_snapshot')){
   assert.deepEqual(p.slice(2),[ORG,WEEK,action]);events.push('snapshot');
   if(state==='uncertain'||state==='pending'||wrongScope)throw Error('blocked');
   return {rows:[{snapshot:{cycleClosed:action==='report',recipients:[action==='report'?{id:RID,email:'qa@example.invalid',role:'manager',active:true}:{id:RID,email:'qa@example.invalid',tokenHash:HASH,expiresAt:'2026-11-30T00:00:00Z',sentAt:action==='reminder'?'2026-11-23T08:00:00Z':null}]}}]};
  }
  if(sql.includes('delivery_publications')){assert.deepEqual(p.slice(2),[ORG,WEEK]);events.push('aggregate');return {rows:[]}}
  if(sql.includes('persist_weekly_digest')){assert.equal(JSON.parse(p[2]).coverage,0);events.push('persist');return {rows:[{finished:true}]}}
  if(sql.includes('reserve_recipient_delivery')){assert.equal(p[2],RID);assert.equal(p[3],createHash('sha256').update([ORG,WEEK,action,RID].join(':')).digest('hex'));events.push('reserve');if(state==='confirmed')return {rows:[{state}]};state='pending';return {rows:[{state:'reserved'}]}}
  if(sql.includes('finish_recipient_delivery')){state=p[4]?'confirmed':'uncertain';events.push(state);return {rows:[{finished:true}]}}
  if(sql.includes('finish_weekly_delivery_job')){events.push(sql.includes(',true)')?'complete':'fail');return {rows:[{finished:true}]}}
  throw Error('unexpected SQL');
 }};
 const provider={async send(message){sendCount++;events.push('send');assert.equal(message.to,'qa@example.invalid');if(action!=='report')assert.ok(message.text.includes(TOKEN));if(providerFails)throw Error('mock timeout');return {accepted:true,id:'fake'};}};
 const config={pool,provider,origin:'https://example.invalid',clock:()=>new Date('2026-11-23T09:00:00Z'),resolveInvitationToken:async scope=>{assert.deepEqual(scope,{organizationId:ORG,weekStart:WEEK,invitationId:RID});return wrongToken?'b'.repeat(64):TOKEN;}};
 return {config,events,sendCount:()=>sendCount,fail:()=>providerFails=true,wrong:()=>wrongToken=true,cross:()=>wrongScope=true};
}
test('disabled by default, no SQL or provider',async()=>{const f=fixture();assert.equal((await createDeliveryPipeline(f.config)()).status,'disabled');assert.deepEqual(f.events,[]);assert.equal(f.sendCount(),0)});
test('invite and reminder pipeline persist receipt; confirmed replay never sends twice',async()=>{for(const action of ['invite','reminder']){const f=fixture(action),run=createDeliveryPipeline({...f.config,enabled:true});assert.equal((await run()).status,'delivered');assert.deepEqual(f.events,['snapshot','reserve','send','confirmed','complete']);assert.equal((await run()).status,'delivered');assert.equal(f.sendCount(),1)}});
test('uncertain provider outcome blocks replay',async()=>{const f=fixture();f.fail();const run=createDeliveryPipeline({...f.config,enabled:true});assert.equal((await run()).status,'failed');assert.ok(f.events.includes('uncertain'));assert.equal((await run()).status,'failed');assert.equal(f.sendCount(),1)});
test('invalid token or scope fails before reservation',async()=>{for(const flag of ['wrong','cross']){const f=fixture();f[flag]();assert.equal((await createDeliveryPipeline({...f.config,enabled:true})()).status,'failed');assert.equal(f.sendCount(),0);assert.ok(!f.events.includes('reserve'))}});
test('report digest persisted before manager notification',async()=>{const f=fixture('report');assert.equal((await createDeliveryPipeline({...f.config,enabled:true})()).status,'delivered');assert.deepEqual(f.events,['snapshot','aggregate','persist','reserve','send','confirmed','complete'])});
