'use strict';
const assert=require('node:assert/strict');
const {createManagerEndpoint}=require('./manager-live-endpoint.cjs');
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const event=(org,token='manager-a')=>({httpMethod:'GET',queryStringParameters:{organization_id:org},requestContext:{identity:{sourceIp:'192.0.2.10'}},headers:{authorization:'Bearer '+token}});
(async()=>{
 const calls=[];
 const bridge={
  authenticate:async(e)=>e.headers.authorization==='Bearer guest'?null:{id:'manager',token:e.headers.authorization.slice(7)},
  readSummary:async({token,organizationId})=>{calls.push([token,organizationId]);if(token==='manager-a'&&organizationId===A)return [{week:'2026-11-23',domain:'clarity',question:'J1',favorablePercent:83.3,rawAnswers:['SECRET']}];throw Error('denied')}
 };
 const handler=createManagerEndpoint({bridge,limit:async()=>true});
 const own=await handler(event(A));
 assert.equal(own.statusCode,200);
 assert.equal(own.body.includes('SECRET'),false);
 assert.equal((await handler(event(B))).statusCode,403);
 assert.equal((await handler(event(A,'guest'))).statusCode,401);
 assert.equal((await handler({...event(A),requestContext:{}})).statusCode,503);
 assert.equal((await createManagerEndpoint({bridge,limit:async()=>false})(event(A))).statusCode,429);
 assert.equal((await handler(event('invalid'))).statusCode,400);
 assert.equal((await handler({...event(A),httpMethod:'POST'})).statusCode,405);
 assert.deepEqual(calls,[['manager-a',A],['manager-a',B]]);
 assert.throws(()=>createManagerEndpoint({bridge}),TypeError);
 console.log('PASS: manager A can read own aggregate only; cross-tenant denied, guest denied, throttle and trusted IP enforced');
})().catch(e=>{console.error(e);process.exitCode=1});
