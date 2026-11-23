'use strict';
const assert=require('node:assert/strict');
const {createStagingPulseAdapter,SQL}=require('./staging-pulse-db-adapter.cjs');
const {createPulseSubmitHandler}=require('./pulse-submit-boundary.cjs');
const token='f'.repeat(64);
const answers=[1,2,3,4].map(i=>({question_id:'00000000-0000-4000-8000-'+String(i).padStart(12,'0'),rating:i}));
const event={httpMethod:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token,answers})};
(async()=>{
 let calls=0;
 const adapter=createStagingPulseAdapter({query:async(sql,params)=>{
  calls++;assert.equal(sql,SQL);assert.equal(params[0],token);
  assert.deepEqual(JSON.parse(params[1]),answers);
  assert.equal(sql.includes(token),false,'no token interpolation in SQL');
  return {rows:[{response_id:'11111111-1111-4111-8111-111111111111'}]};
 }});
 const handler=createPulseSubmitHandler({adapter,rateLimit:async()=>true});
 const success=await handler(event);
 assert.equal(success.statusCode,200);
 assert.equal(success.body.includes('11111111'),false,'no response ID leak');
 assert.equal(calls,1);
 const reject=createPulseSubmitHandler({adapter,rateLimit:async()=>false});
 assert.equal((await reject(event)).statusCode,429);assert.equal(calls,1);
 const failed=createPulseSubmitHandler({adapter:createStagingPulseAdapter({query:async()=>{throw Error('SECRET token and database details')}}),rateLimit:async()=>true});
 const error=await failed(event);
 assert.equal(error.statusCode,400);assert.equal(error.body.includes('SECRET'),false);
 console.log('PASS: parameterized private RPC adapter, no response ID leakage, deny on throttling');
})().catch(e=>{console.error(e);process.exitCode=1});
