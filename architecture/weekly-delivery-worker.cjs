'use strict';
// Durable queue worker core. The storage adapter MUST atomically lease a job
// with a unique worker token, and acknowledge using that token (compare-and-set).
// This module never sends email without an explicitly injected sender.
const ACTIONS=new Set(['invite','reminder','report']);
function createWeeklyDeliveryWorker({store,sender,enabled=false,clock=()=>new Date()}={}){
 if(!store||typeof store.claim!=='function'||typeof store.complete!=='function'||typeof store.fail!=='function'||typeof sender?.send!=='function')throw TypeError('Durable store and sender required');
 return async function processNext(){
  if(!enabled)return {status:'disabled'};
  const job=await store.claim();
  if(!job)return {status:'empty'};
  if(!Number.isSafeInteger(job.id)||job.id<1||typeof job.leaseToken!=='string'||job.leaseToken.length<16||
     !ACTIONS.has(job.action)||typeof job.organizationId!=='string'||typeof job.weekStart!=='string')
   throw Error('Invalid leased job');
  try{
   const result=await sender.send({jobId:job.id,organizationId:job.organizationId,weekStart:job.weekStart,action:job.action,idempotencyKey:job.organizationId+':'+job.weekStart+':'+job.action});
   if(result?.accepted!==true)throw Error('Delivery not accepted');
   if(await store.complete(job.id,job.leaseToken,clock())!==true)throw Error('Delivery acknowledgment failed');
   return {status:'delivered',jobId:job.id};
  }catch(error){
   try{await store.fail(job.id,job.leaseToken,clock())}catch{}
   // Never expose provider errors, tokens, recipients, or message content.
   return {status:'failed',jobId:job.id};
  }
 };
}
module.exports={createWeeklyDeliveryWorker};
