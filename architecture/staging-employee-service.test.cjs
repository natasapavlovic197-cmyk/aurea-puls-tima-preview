'use strict';
const assert=require('node:assert/strict');
const {createStagingEmployeeService}=require('./staging-employee-service.cjs');
const {SQL}=require('./postgres-durable-limiter.cjs');
const hash='b'.repeat(64);
const calls=[];
let hits=0;
const pool={async connect(){return {
 async query(sql,params){calls.push(sql);if(sql.includes('session_user as login_user'))return {rows:[{login_user:'aurea_limiter_login',active_user:'aurea_rate_limiter',bypassrls:false}]};if(sql===SQL){assert.match(params[0],/^[a-f0-9]{64}$/);return {rows:[{hits:++hits}]}}return {rows:[]}},
 release(){}
}}};
const adapter={
 async invitation(h){assert.equal(h,hash);return {status:'ready',questions:['A_CLARITY','A_WORKLOAD','A_SPEAKUP','R_LEADER_HELP','R_INFO','R_PRIORITY'].map((code,i)=>({code,wording:'Pitanje '+(i+1),position:i+1}))}},
 async submit(h,a){assert.equal(h,hash);assert.equal(a.length,6);return {status:'submitted'}}
};
const event=(action,extra={})=>({httpMethod:'POST',headers:{'content-type':'application/json'},requestContext:{identity:{sourceIp:'192.0.2.3'}},body:JSON.stringify({action,hash,...extra})});
(async()=>{
 assert.throws(()=>createStagingEmployeeService({pool,limiterSecret:'short',adapter}),TypeError);
 assert.throws(()=>createStagingEmployeeService({pool,limiterSecret:'x'.repeat(64)}),TypeError);
 const handler=createStagingEmployeeService({pool,limiterSecret:'x'.repeat(64),adapter}).handler;
 assert.equal((await handler(event('invitation'))).statusCode,200);
 assert.equal((await handler(event('submit',{answers:['A_CLARITY','A_WORKLOAD','A_SPEAKUP','R_LEADER_HELP','R_INFO','R_PRIORITY'].map(code=>({code,rating:5}))}))).statusCode,200);
 assert.ok(calls.includes('SET LOCAL ROLE aurea_rate_limiter'));assert.ok(calls.includes(SQL));
 assert.equal((await handler({...event('invitation'),requestContext:{}})).statusCode,429);
 const failPool={async connect(){throw Error('Database unavailable')}};
 const denied=createStagingEmployeeService({pool:failPool,limiterSecret:'x'.repeat(64),adapter}).handler;
 assert.equal((await denied(event('invitation'))).statusCode,429);
 console.log('PASS: employee service composes trusted adapter with restricted durable limiter; fails closed');
})().catch(e=>{console.error(e);process.exitCode=1});
