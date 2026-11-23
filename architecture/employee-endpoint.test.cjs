const test=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {createEmployeeEndpoint}=require('./employee-endpoint.cjs');
const token='a'.repeat(64),answers=['A','B','C','D','E','F'].map(code=>({code,rating:4}));
const req={method:'POST',path:'/api/employee/submit',sourceIp:'127.0.0.1',body:JSON.stringify({token,answers})};
test('only hash and permitted answer fields reach RPC',async()=>{
 const h=createEmployeeEndpoint({limit:async()=>true,rpc:async(name,args)=>{assert.equal(name,'aurea_employee_submit');assert.equal(args.p_hash,createHash('sha256').update(token).digest('hex'));assert.deepEqual(args.p_answers,answers);return {status:'submitted'};}});
 assert.equal(JSON.parse((await h(req)).body).status,'submitted');
});
test('invalid or throttled requests never reach RPC',async()=>{
 for(const allowed of [true,false]){
 const h=createEmployeeEndpoint({limit:async()=>allowed,rpc:async()=>{throw Error('unexpected RPC');}});
 assert.equal((await h({...req,body:'{}'})).statusCode,allowed?400:429);
 }
});
test('database denial never becomes success',async()=>{
 const h=createEmployeeEndpoint({limit:async()=>true,rpc:async()=>({status:'unavailable'})});
 assert.equal((await h(req)).statusCode,409);
});
