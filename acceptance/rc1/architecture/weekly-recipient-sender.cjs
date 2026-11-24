'use strict';
const {planMessages}=require('./weekly-message-plan.cjs');
const {buildWeeklyDigest}=require('./weekly-report-digest.cjs');
// Store must atomically reserve each recipient delivery under the current job lease.
// Unknown provider outcomes require reconciliation, not blind retries.
function createRecipientSender({store,provider,origin,enabled=false,clock=()=>new Date()}={}){
 if(!store||['loadScopedRecipients','reserve','confirm','markUncertain'].some(k=>typeof store[k]!=='function')||typeof provider?.send!=='function')throw TypeError('Delivery dependencies required');
 return {async send(job){
 if(!enabled)return {accepted:false};
 const snapshot=await store.loadScopedRecipients(job);
 if(!snapshot||typeof snapshot.cycleClosed!=='boolean')throw Error('Invalid snapshot');
 const messages=planMessages({job:{...job,cycleClosed:snapshot.cycleClosed},recipients:snapshot.recipients,origin,now:clock()});
 if(job.action==='report'){
 if(!snapshot.cycleClosed)return {accepted:false};
 if(typeof store.loadPublications!=='function'||typeof store.publishDigest!=='function')throw Error('Report persistence required');
 const rows=await store.loadPublications(job);
 const digest=buildWeeklyDigest({organizationId:job.organizationId,weekStart:job.weekStart,rows});
 if(await store.publishDigest({job,digest})!==true)return {accepted:false};
 }
 for(const message of messages){
 const reservation=await store.reserve({job,recipientId:message.recipientId,key:message.idempotencyKey});
 if(reservation==='confirmed'||reservation==='ineligible')continue;
 if(reservation!=='reserved')return {accepted:false};
 try{
 const result=await provider.send(message);
 if(result?.accepted!==true||typeof result.id!=='string'||!result.id)throw Error('Unconfirmed provider outcome');
 if(await store.confirm({job,key:message.idempotencyKey,providerId:result.id})!==true)throw Error('Unconfirmed persistence');
 }catch{
 await store.markUncertain({job,key:message.idempotencyKey});
 return {accepted:false};
 }
 }
 return {accepted:true};
 }};
}
module.exports={createRecipientSender};
