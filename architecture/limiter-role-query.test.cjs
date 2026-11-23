const test=require('node:test');
const assert=require('node:assert/strict');
const {createLimiterRoleQuery}=require('./limiter-role-query.cjs');
test('role is local to transaction',async()=>{
 const calls=[];const query=createLimiterRoleQuery({connect:async()=>({query:async(s,a)=>{calls.push([s,a]);return {rows:[{hits:1}]};},release:d=>calls.push(['release',d])})});
 await query('SELECT $1',[1]);assert.deepEqual(calls.map(x=>x[0]),['BEGIN','SET LOCAL ROLE aurea_rate_limiter','SELECT $1','COMMIT','release']);
});
test('failed activation rolls back without running data query',async()=>{
 const calls=[];const query=createLimiterRoleQuery({connect:async()=>({query:async(s)=>{calls.push(s);if(s.startsWith('SET'))throw Error('denied');},release:()=>calls.push('release')})});
 await assert.rejects(query('SELECT 1',[]));assert.deepEqual(calls,['BEGIN','SET LOCAL ROLE aurea_rate_limiter','ROLLBACK','release']);
});
