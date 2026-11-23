const test=require('node:test');
const assert=require('node:assert/strict');
const {createEmployeePostgresBridge}=require('./employee-postgres-bridge.cjs');
const hash='a'.repeat(64);
test('only parameterized invitation and submission functions are callable',async()=>{
 const calls=[];
 const rpc=createEmployeePostgresBridge({query:async(sql,args)=>{calls.push({sql,args});return {rows:[{result:{status:'ready'}}]};}});
 await rpc('aurea_employee_invitation',{p_hash:hash});
 await rpc('aurea_employee_submit',{p_hash:hash,p_answers:Array.from({length:6},(_,i)=>({code:'A'+i,rating:4}))});
 assert.equal(calls.length,2);assert.equal(calls[0].args[0],hash);assert.match(calls[1].sql,/\$2::jsonb/);
 await assert.rejects(rpc('aurea_manager_summary',{p_hash:hash}));
 await assert.rejects(rpc('aurea_employee_invitation',{p_hash:'bad'}));
 assert.equal(calls.length,2);
});
test('missing database confirmation fails closed',async()=>{
 const rpc=createEmployeePostgresBridge({query:async()=>({rows:[]})});
 await assert.rejects(rpc('aurea_employee_invitation',{p_hash:hash}));
});
