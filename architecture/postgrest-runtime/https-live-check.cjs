'use strict';
const assert=require('node:assert/strict');
const cfg=require('./staging-public-config.cjs');
const {createPostgrestTransport}=require('./browser-transport.cjs');
async function main(){
 const headers={apikey:cfg.key,'content-type':'application/json'};
 const post=(name,body,extra={})=>fetch(cfg.url+'/rest/v1/rpc/'+name,{method:'POST',headers:{...headers,...extra},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(12000)});
 const invalid={p_action:'invitation',p_token:'invalid',p_answers:null};
 const r=await post('aurea_employee_pulse_v2',invalid);
 assert.equal(r.status,200,'employee HTTPS status');assert.deepEqual(await r.json(),{status:'unavailable'});
 console.log('PASS: live HTTPS employee RPC responds and rejects malformed capability');
 const old=await post('aurea_employee_invitation',{p_hash:'0'.repeat(64)});
 assert.ok([401,403,404].includes(old.status),'legacy RPC unexpectedly reachable');
 const manager=await post('aurea_my_companies',{});
 assert.ok([401,403,404].includes(manager.status),'anonymous manager RPC unexpectedly reachable');
 const privateSchema=await post('employee_pulse_v2',invalid,{'Content-Profile':'aurea_rpc_private'});
 assert.equal(privateSchema.status,406,'private schema unexpectedly exposed');
 const table=await fetch(cfg.url+'/rest/v1/employee_limits?select=bucket&limit=0',{headers:{apikey:cfg.key,'Accept-Profile':'aurea_rpc_private'},redirect:'error',signal:AbortSignal.timeout(12000)});
 assert.equal(table.status,406,'private table schema unexpectedly exposed');
 console.log('PASS: legacy RPC, anonymous manager and private schema access denied');
 const transport=createPostgrestTransport(cfg);
 const res=await transport('/api/employee/invitation',{method:'POST',body:JSON.stringify({token:'0'.repeat(64)})});
 assert.equal(res.status,404,'employee adapter expected unknown invitation denial');
 console.log('PASS: actual premium employee transport reaches live RPC and denies unknown invitation');
}
main().catch(e=>{console.error('HTTPS integration failed:',e instanceof assert.AssertionError?e.message:'network or response failure');process.exitCode=1});
