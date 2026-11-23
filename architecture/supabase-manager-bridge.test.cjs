'use strict';
const assert=require('node:assert/strict');
const {createManagerBridge}=require('./supabase-manager-bridge.cjs');
const org='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',uid='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',calls=[];
const bridge=createManagerBridge({url:'https://example-project.supabase.co',key:'test-publishable-key',fetchImpl:async(url,options)=>{
 calls.push({url,options});
 if(url.endsWith('/auth/v1/user'))return {ok:true,json:async()=>({id:uid,email:'private@example.com'})};
 if(url.endsWith('/rest/v1/rpc/aurea_manager_summary'))return {ok:true,json:async()=>[{week_start:'2026-11-23',domain:'clarity',question_code:'J1',favorable_percent:'83.3',response_count:6,recipient_address:'SECRET'}]};
 throw Error('Unexpected URL');
}});
(async()=>{
 assert.equal(await bridge.authenticate({headers:{authorization:'Bearer invalid'}}),null);
 assert.equal(calls.length,0);
 const user=await bridge.authenticate({headers:{authorization:'Bearer header.payload.signature'}});
 assert.equal(user.id,uid);
 const summary=await bridge.readSummary({token:user.token,organizationId:org});
 assert.deepEqual(summary,[{week:'2026-11-23',domain:'clarity',question:'J1',favorablePercent:83.3}]);
 assert.equal(JSON.stringify(summary).includes('SECRET'),false);
 assert.equal(JSON.stringify(summary).includes('response_count'),false);
 assert.equal(calls[1].options.headers.authorization,'Bearer header.payload.signature');
 assert.deepEqual(JSON.parse(calls[1].options.body),{p_organization_id:org});
 await assert.rejects(()=>bridge.readSummary({token:user.token,organizationId:'wrong'}),TypeError);
 const denied=createManagerBridge({url:'https://example-project.supabase.co',key:'test',fetchImpl:async()=>({ok:false})});
 assert.equal(await denied.authenticate({headers:{authorization:'Bearer header.payload.signature'}}),null);
 await assert.rejects(()=>denied.readSummary({token:'abc',organizationId:org}),/denied/);
 console.log('PASS: verified user token forwarded to tenant-authorized RPC; safe allowlisted fields; fail closed');
})().catch(e=>{console.error(e);process.exitCode=1});
