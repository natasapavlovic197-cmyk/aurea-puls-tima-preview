const test=require('node:test');
const assert=require('node:assert/strict');
const {createRecipientSender}=require('./weekly-recipient-sender.cjs');
const job={organizationId:'11111111-1111-4111-8111-111111111111',weekStart:'2026-11-23',action:'report'};
const manager={...job,id:'22222222-2222-4222-8222-222222222222',email:'qa@example.invalid',role:'manager',active:true};
function fixture(){
 const calls=[];
 const store={loadScopedRecipients:async()=>({cycleClosed:true,recipients:[manager]}),loadPublications:async()=>[],publishDigest:async({digest})=>{calls.push('publish');assert.equal(digest.coverage,0);return true;},reserve:async()=>{calls.push('reserve');return 'reserved';},confirm:async()=>true,markUncertain:async()=>{}};
 const provider={send:async message=>{calls.push('send');assert.ok(!message.text.includes('coverage'));return {accepted:true,id:'fake'};}};
 return {store,provider,calls,origin:'https://example.invalid',enabled:true};
}
test('report is persisted before notification',async()=>{const f=fixture();assert.equal((await createRecipientSender(f).send(job)).accepted,true);assert.deepEqual(f.calls,['publish','reserve','send']);});
test('unconfirmed publication blocks sending',async()=>{const f=fixture();f.store.publishDigest=async()=>false;assert.equal((await createRecipientSender(f).send(job)).accepted,false);assert.deepEqual(f.calls,[]);});
test('open cycle cannot be completed as report',async()=>{const f=fixture();f.store.loadScopedRecipients=async()=>({cycleClosed:false,recipients:[manager]});assert.equal((await createRecipientSender(f).send(job)).accepted,false);assert.deepEqual(f.calls,[]);});
