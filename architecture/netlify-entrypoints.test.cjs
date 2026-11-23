'use strict';
const assert=require('node:assert/strict');
const manager=require('../netlify/functions/aurea-manager-summary.cjs');
const employee=require('../netlify/functions/aurea-employee.cjs');
(async()=>{
 for(const val of [undefined,'true','false']){
  if(val===undefined)delete process.env.AUREA_B2B_MANAGER_ENABLED;else process.env.AUREA_B2B_MANAGER_ENABLED=val;
  const r=await manager.handler({httpMethod:'GET',headers:{authorization:'Bearer fake'},queryStringParameters:{organization_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}});
  assert.equal(r.statusCode,503,'no manager data before durable limiter');
  assert.equal(r.body.includes('aaaaaaaa'),false);
 }
 const r=await employee.handler({httpMethod:'POST',body:'{ "token": "private" }'});
 assert.equal(r.statusCode,503);
 assert.equal(r.body.includes('private'),false);
 console.log('PASS: Netlify endpoints are safely closed until approved deployment dependencies exist');
})().catch(e=>{console.error(e);process.exitCode=1});
