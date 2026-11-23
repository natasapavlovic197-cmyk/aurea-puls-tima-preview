const test=require('node:test');
const assert=require('node:assert/strict');
const {createStagingServer}=require('./staging-manager-server.cjs');
const {createEmployeeEndpoint}=require('./employee-endpoint.cjs');
const {createEmployeeClient}=require('./employee-live-client.cjs');
test('employee HTTP round trip with simulated RPC',async()=>{
 const questions=['A','B','C','D','E','F'].map((code,i)=>({code,wording:code,position:i+1}));
 let redeemed=false;
 const employeeHandler=createEmployeeEndpoint({limit:async()=>true,rpc:async(name)=>name.endsWith('invitation')?{status:redeemed?'unavailable':'ready',questions}:redeemed?{status:'unavailable'}:(redeemed=true,{status:'submitted'})});
 const server=createStagingServer({employeeHandler});
 try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const make=()=>createEmployeeClient({token:'a'.repeat(64),fetchImpl:(p,o)=>fetch(base+p,o)});
 const client=make();await client.load();
 assert.equal(await client.submit(Object.fromEntries(questions.map(q=>[q.code,4]))),true);
 await assert.rejects(make().load());
 }finally{await new Promise(r=>server.close(r));}
});
