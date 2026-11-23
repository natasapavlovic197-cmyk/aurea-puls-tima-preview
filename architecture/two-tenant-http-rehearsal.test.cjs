'use strict';
const assert=require('node:assert/strict');
const {createManagerBridge}=require('./supabase-manager-bridge.cjs');
const {createManagerEndpoint}=require('./manager-live-endpoint.cjs');
const ORG_A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ORG_B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const USER_A='11111111-1111-4111-8111-111111111111';
const USER_B='22222222-2222-4222-8222-222222222222';
const tokenToUser={'jwt.a.signature':USER_A,'jwt.b.signature':USER_B};
const membership={[USER_A]:ORG_A,[USER_B]:ORG_B};
const calls=[];
const fetchImpl=async(url,options)=>{
 const token=options.headers.authorization.slice(7);
 calls.push({path:url.split('/').slice(-2).join('/'),token});
 if(url.endsWith('/auth/v1/user'))return tokenToUser[token]?{ok:true,json:async()=>({id:tokenToUser[token]})}:{ok:false};
 if(url.endsWith('/rpc/aurea_manager_summary')){
  const org=JSON.parse(options.body).p_organization_id;
  if(membership[tokenToUser[token]]!==org)return {ok:false,status:403};
  return {ok:true,json:async()=>[{week_start:'2026-11-23',question_code:'CLARITY',domain:'clarity',response_count:6,favorable_percent:'83.3',respondent_email:'NEVER EXPOSE'}]};
 }
 throw Error('unexpected');
};
const bridge=createManagerBridge({url:'https://staging-example.supabase.co',key:'publishable-test-key',fetchImpl});
const endpoint=createManagerEndpoint({bridge,limit:async()=>true});
const event=(org,token)=>({httpMethod:'GET',queryStringParameters:{organization_id:org},requestContext:{identity:{sourceIp:'198.51.100.7'}},headers:{authorization:'Bearer '+token}});
(async()=>{
 for(const [token,own,other] of [['jwt.a.signature',ORG_A,ORG_B],['jwt.b.signature',ORG_B,ORG_A]]){
  const good=await endpoint(event(own,token));
  assert.equal(good.statusCode,200);
  assert.equal(JSON.parse(good.body).report[0].favorablePercent,83.3);
  assert.equal(good.body.includes('respondent_email'),false);
  assert.equal(good.body.includes('NEVER EXPOSE'),false);
  assert.equal((await endpoint(event(other,token))).statusCode,403);
 }
 assert.equal((await endpoint(event(ORG_A,'fake.jwt.token'))).statusCode,401);
 assert.equal(calls.filter(x=>x.path==='rpc/aurea_manager_summary').length,4);
 console.log('PASS: two synthetic JWTs, two organizations, own summaries allowed, cross-org denied, aggregate fields only');
})().catch(e=>{console.error(e);process.exitCode=1});
