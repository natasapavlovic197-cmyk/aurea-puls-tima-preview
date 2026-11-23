'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createServerEntry}=require('./manager-server-entry.cjs');
const env={AUREA_SUPABASE_URL:'https://example.supabase.co',AUREA_SUPABASE_PUBLISHABLE_KEY:'test-key',AUREA_LIMITER_SECRET:'x'.repeat(32)};
const event={httpMethod:'GET',queryStringParameters:{organization_id:'12345678-1234-1234-1234-123456789abc'},requestContext:{identity:{sourceIp:'192.0.2.1'}},headers:{}};
test('missing restricted query fails closed',async()=>{const r=await createServerEntry({env})(event);assert.equal(r.statusCode,503);assert.equal(r.headers['cache-control'],'no-store');});
test('missing token cannot access data',async()=>{let calls=0;const r=await createServerEntry({env,query:async()=>({rows:[{hits:1}]}),fetchImpl:async()=>{calls++;throw Error('unexpected fetch')}})(event);assert.equal(r.statusCode,403);assert.equal(calls,0);});
test('limiter failure denies request',async()=>{const r=await createServerEntry({env,query:async()=>{throw Error('database unavailable')}})(event);assert.equal(r.statusCode,429);});
