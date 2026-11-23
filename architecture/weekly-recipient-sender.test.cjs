const test=require('node:test');
const assert=require('node:assert/strict');
const {createRecipientSender}=require('./weekly-recipient-sender.cjs');
const job={organizationId:'11111111-1111-4111-8111-111111111111',weekStart:'2026-11-23',action:'invite'};
const recipient={...job,id:'22222222-2222-4222-8222-222222222222',email:'qa@example.invalid',token:'a'.repeat(64),expiresAt:'2026-11-27T12:00:00Z'};
function fixture(){
 const state=new Map();let sent=0;
 const store={loadScopedRecipients:async()=>({cycleClosed:false,recipients:[recipient]}),reserve:async({key})=>{if(state.has(key))return state.get(key);state.set(key,'pending');return 'reserved';},confirm:async({key})=>{state.set(key,'confirmed');return true;},markUncertain:async({key})=>state.set(key,'uncertain')};
 const provider={send:async()=>{sent++;return {accepted:true,id:'qa-1'};}};
 return {store,provider,state,count:()=>sent,origin:'https://example.invalid',clock:()=>new Date('2026-11-23T09:00:00Z')};
}
test('disabled by default and confirmed recipient is never resent',async()=>{
 const f=fixture();assert.equal((await createRecipientSender(f).send(job)).accepted,false);assert.equal(f.count(),0);
 const sender=createRecipientSender({...f,enabled:true});assert.equal((await sender.send(job)).accepted,true);assert.equal((await sender.send(job)).accepted,true);assert.equal(f.count(),1);
});
test('uncertain outcome blocks blind retry',async()=>{
 const f=fixture();const sender=createRecipientSender({...f,enabled:true,provider:{send:async()=>{throw Error('timeout');}}});
 assert.equal((await sender.send(job)).accepted,false);assert.equal([...f.state.values()][0],'uncertain');
 assert.equal((await createRecipientSender({...f,enabled:true}).send(job)).accepted,false);assert.equal(f.count(),0);
});
