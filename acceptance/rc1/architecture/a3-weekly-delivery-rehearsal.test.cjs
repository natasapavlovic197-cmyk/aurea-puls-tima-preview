'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {runWeeklyJob}=require('./weekly-job-runner.cjs');
const {createDeliveryPipeline}=require('./weekly-delivery-pipeline.cjs');
const WEEK='2026-11-23', ORGS=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
const hash=x=>createHash('sha256').update(x).digest('hex');
test('RC1 corrected links across complete isolated two-tenant cycle',async()=>{
 const jobs=[],keys=new Set(),receipts=new Map(),digests=new Map(),outbox=[];
 const tenants=new Map(ORGS.map((org,t)=>[org,{closed:false,responded:0,manager:{id:org,email:'manager'+t+'@example.invalid',role:'manager',active:true},employees:Array.from({length:6},(_,i)=>{const id='00000000-0000-4000-8000-'+String(t*6+i+1).padStart(12,'0'),token=hash(id);return {id,token,tokenHash:hash(token),email:'employee'+t+'-'+i+'@example.invalid',expiresAt:'2026-11-30T00:00:00Z',sentAt:null,reminderAt:null,redeemedAt:null}})}]));
 let now=new Date('2026-11-23T08:00:00Z'),seq=0;
 const delivery={async reserve(key,job){if(keys.has(key))return false;keys.add(key);jobs.push({...job,id:++seq,state:'pending'});return true},async dispatch(){}};
 const pool={async query(sql,p){
  if(sql.includes('claim_weekly_delivery_job')){const j=jobs.find(x=>x.state==='pending');if(!j)return {rows:[]};j.state='processing';j.lease=p[0];return {rows:[{id:String(j.id),organization_id:j.tenantId,week_start:j.weekStart,action:j.action,lease_token:j.lease}]}}
  const j=jobs.find(x=>x.id===p[0]);assert.equal(j.lease,p[1]);assert.equal(j.state,'processing');const t=tenants.get(j.tenantId);
  if(sql.includes('delivery_snapshot')){assert.deepEqual(p.slice(2),[j.tenantId,WEEK,j.action]);return {rows:[{snapshot:{cycleClosed:t.closed,recipients:j.action==='report'?[t.manager]:t.employees.filter(e=>!e.redeemedAt&&(j.action==='invite'?!e.sentAt:e.sentAt&&!e.reminderAt)).map(({token,...e})=>e)}}]}}
  if(sql.includes('delivery_publications')){assert.deepEqual(p.slice(2),[j.tenantId,WEEK]);return {rows:t.responded>=5?[{week_start:WEEK,item_code:'A_WORKLOAD',item_version:1,domain:'workload',response_count:t.responded,favorable_percent:20,closed:true}]:[]}}
  if(sql.includes('persist_weekly_digest')){assert.equal(j.action,'report');const d=JSON.parse(p[2]);assert.equal(d.coverage,t.responded>=5?1:0);digests.set(j.tenantId,d);return {rows:[{finished:true}]}}
  if(sql.includes('reserve_recipient_delivery')){assert.equal(p[3],hash([j.tenantId,WEEK,j.action,p[2]].join(':')));assert.ok((j.action==='report'?[t.manager]:t.employees).some(e=>e.id===p[2]));if(receipts.has(p[3]))return {rows:[{state:'confirmed'}]};receipts.set(p[3],{id:p[2],state:'pending'});return {rows:[{state:'reserved'}]}}
  if(sql.includes('finish_recipient_delivery')){assert.equal(p[4],true);const receipt=receipts.get(p[2]);receipt.state='confirmed';const e=t.employees.find(e=>e.id===receipt.id);if(e)e[j.action==='invite'?'sentAt':'reminderAt']=now.toISOString();return {rows:[{finished:true}]}}
  if(sql.includes('finish_weekly_delivery_job')){assert.ok(sql.includes(',true)'));j.state='delivered';return {rows:[{finished:true}]}}
  throw Error('Unexpected query');
 }};
 const run=createDeliveryPipeline({pool,origin:'https://example.invalid',enabled:true,clock:()=>now,resolveInvitationToken:async({organizationId,invitationId})=>tenants.get(organizationId).employees.find(e=>e.id===invitationId).token,provider:{async send(m){assert.ok(m.to.endsWith('@example.invalid'));outbox.push(m);return {accepted:true,id:'fake-'+outbox.length}}}});
 async function tick(date){now=new Date(date);for(const tenantId of ORGS){const args={instant:now,tenantId,weekStart:WEEK,delivery,enabled:true};assert.equal((await runWeeklyJob(args)).status,'dispatched');assert.equal((await runWeeklyJob(args)).status,'already_processed')}for(let i=0;i<2;i++)assert.equal((await run()).status,'delivered');assert.equal((await run()).status,'empty')}
 await tick('2026-11-23T08:00:00Z');assert.equal(outbox.length,12);assert.ok(outbox.every(m=>/https:\/\/example\.invalid\/odgovor\/#[a-f0-9]{64}/.test(m.text)));
 for(const [index,org] of ORGS.entries()){const t=tenants.get(org);t.responded=index===0?5:4;t.employees.slice(0,t.responded).forEach(e=>e.redeemedAt='2026-11-24T08:00:00Z')}
 await tick('2026-11-25T08:00:00Z');assert.equal(outbox.length,15);assert.ok(outbox.slice(12).every(m=>/https:\/\/example\.invalid\/odgovor\/#[a-f0-9]{64}/.test(m.text)));
 for(const t of tenants.values())t.closed=true;
 await tick('2026-11-27T08:00:00Z');assert.equal(outbox.length,17);assert.ok(outbox.slice(15).every(m=>m.text.includes("https://example.invalid/portal/")));assert.equal(jobs.length,6);assert.equal(receipts.size,17);assert.equal(digests.get(ORGS[0]).coverage,1);assert.equal(digests.get(ORGS[1]).coverage,0);assert.equal(digests.get(ORGS[1]).nextAction,null);assert.equal(new Set(outbox.map(m=>m.idempotencyKey)).size,17);
});
