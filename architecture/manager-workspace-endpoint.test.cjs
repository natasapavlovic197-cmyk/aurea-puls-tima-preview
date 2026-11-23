'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createManagerWorkspaceEndpoint}=require('./manager-workspace-endpoint.cjs');
const org='12345678-1234-1234-1234-123456789abc';
function fixture(allowed=true){
 const calls=[];
 const handler=createManagerWorkspaceEndpoint({limit:async()=>allowed,service:{overview:async(e,o)=>{calls.push(o);return {report:{},activities:[]}},save:async(e,o,input)=>{calls.push({o,input});return {id:org}}}});
 const event={httpMethod:'GET',queryStringParameters:{organization_id:org},requestContext:{identity:{sourceIp:'192.0.2.1'}}};
 return {handler,event,calls};
}
test('workspace read is private and scoped',async()=>{const {handler,event,calls}=fixture();const r=await handler(event);assert.equal(r.statusCode,200);assert.equal(r.headers['cache-control'],'no-store');assert.deepEqual(calls,[org]);});
test('workspace save forwards validated JSON',async()=>{const {handler,event,calls}=fixture();const r=await handler({...event,httpMethod:'POST',body:JSON.stringify({description:'QA activity'})});assert.equal(r.statusCode,200);assert.deepEqual(calls,[{o:org,input:{description:'QA activity'}}]);});
test('rate limit blocks access',async()=>{const {handler,event,calls}=fixture(false);assert.equal((await handler(event)).statusCode,429);assert.equal(calls.length,0);});
test('invalid body and method rejected',async()=>{const {handler,event,calls}=fixture();assert.equal((await handler({...event,httpMethod:'POST',body:'[]'})).statusCode,400);assert.equal((await handler({...event,httpMethod:'DELETE'})).statusCode,405);assert.equal(calls.length,0);});
test('missing trusted source IP fails closed',async()=>{const {handler,event,calls}=fixture();assert.equal((await handler({...event,requestContext:{}})).statusCode,503);assert.equal(calls.length,0);});
