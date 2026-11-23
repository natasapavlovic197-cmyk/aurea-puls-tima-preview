'use strict';
const assert=require('node:assert/strict');
const {createWeeklyDeliveryWorker}=require('./weekly-delivery-worker.cjs');
const job={id:7,leaseToken:'a'.repeat(32),organizationId:'org-1',weekStart:'2026-11-23',action:'invite'};
(async()=>{
 let sent=0,completed=0,failed=0;
 const store={claim:async()=>job,complete:async(id,token)=>{assert.equal(id,7);assert.equal(token,job.leaseToken);completed++;return true},fail:async()=>{failed++;return true}};
 const sender={send:async(payload)=>{sent++;assert.equal(payload.idempotencyKey,'org-1:2026-11-23:invite');return {accepted:true}}};
 const disabled=createWeeklyDeliveryWorker({store,sender});
 assert.deepEqual(await disabled(),{status:'disabled'});assert.equal(sent,0);
 const active=createWeeklyDeliveryWorker({store,sender,enabled:true});
 assert.deepEqual(await active(),{status:'delivered',jobId:7});assert.equal(sent,1);assert.equal(completed,1);
 const rejected=createWeeklyDeliveryWorker({store,sender:{send:async()=>({accepted:false})},enabled:true});
 assert.deepEqual(await rejected(),{status:'failed',jobId:7});assert.equal(failed,1);
 const empty=createWeeklyDeliveryWorker({store:{...store,claim:async()=>null},sender,enabled:true});
 assert.deepEqual(await empty(),{status:'empty'});
 const invalid=createWeeklyDeliveryWorker({store:{...store,claim:async()=>({...job,leaseToken:'short'})},sender,enabled:true});
 await assert.rejects(()=>invalid(),/Invalid leased job/);
 assert.throws(()=>createWeeklyDeliveryWorker({store}),TypeError);
 for(const action of ['reminder','report']){
 const candidate={...job,action};
 const run=createWeeklyDeliveryWorker({enabled:true,store:{...store,claim:async()=>candidate},sender:{send:async payload=>{assert.equal(payload.action,action);assert.equal(payload.idempotencyKey,'org-1:2026-11-23:'+action);return {accepted:true};}}});
 assert.deepEqual(await run(),{status:'delivered',jobId:7});
 }
 const unconfirmed=createWeeklyDeliveryWorker({enabled:true,store:{...store,complete:async()=>false},sender});
 assert.deepEqual(await unconfirmed(),{status:'failed',jobId:7});
 console.log('PASS: weekly delivery worker gated, leased, idempotency-keyed and fail-closed');
})().catch(e=>{console.error(e);process.exitCode=1});
