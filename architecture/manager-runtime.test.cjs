'use strict';
const assert=require('node:assert/strict');
const {createManagerRuntime}=require('./manager-runtime.cjs');
const org='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const uid='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const event={httpMethod:'GET',queryStringParameters:{organization_id:org},requestContext:{identity:{sourceIp:'192.0.2.55'}},headers:{authorization:'Bearer signed.test.jwt'}};
(async()=>{
 assert.throws(()=>createManagerRuntime({}),TypeError);
 let hits=0;
 const fetchImpl=async(url)=>{
  if(url.endsWith('/auth/v1/user'))return {ok:true,json:async()=>({id:uid})};
  if(url.endsWith('/rpc/aurea_manager_summary'))return {ok:true,json:async()=>[{week_start:'2026-11-23',question_code:'Q1',domain:'clarity',response_count:6,favorable_percent:80}]};
  throw Error('Unexpected fetch');
 };
 const handler=createManagerRuntime({supabaseUrl:'https://test.supabase.co',publishableKey:'test-public-key',fetchImpl,limiterSecret:'s'.repeat(64),query:async(sql,params)=>{assert.match(sql,/on conflict/);assert.match(params[0],/^[a-f0-9]{64}$/);return {rows:[{hits:++hits}]}}});
 for(let i=0;i<20;i++)assert.equal((await handler(event)).statusCode,200);
 assert.equal((await handler(event)).statusCode,429);
 const down=createManagerRuntime({supabaseUrl:'https://test.supabase.co',publishableKey:'test-public-key',fetchImpl,limiterSecret:'s'.repeat(64),query:async()=>{throw Error('DB DOWN')}});
 assert.equal((await down(event)).statusCode,429);
 console.log('PASS: manager runtime uses durable SQL limiter, 20/5min threshold, denies missing credentials and DB failure');
})().catch(e=>{console.error(e);process.exitCode=1});
