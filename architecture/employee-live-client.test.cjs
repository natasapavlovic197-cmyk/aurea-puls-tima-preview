const test=require('node:test');
const assert=require('node:assert/strict');
const {createEmployeeClient}=require('./employee-live-client.cjs');
const questions=['A','B','C','D','E','F'].map((code,i)=>({code,wording:'Question '+code,position:i+1}));
test('six answers and confirmed submission prevent repeat',async()=>{
 const calls=[];
 const client=createEmployeeClient({token:'a'.repeat(64),fetchImpl:async(path,opts)=>{calls.push(JSON.parse(opts.body));return {ok:true,json:async()=>path.endsWith('invitation')?{status:'ready',questions}:{status:'submitted'}};}});
 await client.load();
 const answers=Object.fromEntries(questions.map(q=>[q.code,6]));
 await assert.rejects(client.submit({A:1}));
 assert.equal(await client.submit(answers),true);
 await assert.rejects(client.submit(answers));
 assert.equal(calls.length,2);assert.equal(calls[1].answers.length,6);
});
test('unconfirmed submission does not show success',async()=>{
 const client=createEmployeeClient({token:'b'.repeat(64),fetchImpl:async(path)=>({ok:true,json:async()=>path.endsWith('invitation')?{status:'ready',questions}:{status:'unavailable'}})});
 await client.load();await assert.rejects(client.submit(Object.fromEntries(questions.map(q=>[q.code,4]))));
});
