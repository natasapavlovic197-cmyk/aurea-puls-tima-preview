'use strict';
const assert=require('node:assert/strict');
const {createManagementAdapter}=require('./management-api.cjs');
const {REF,ROLES}=require('./provision.cjs');
(async()=>{
 const calls=[];
 const fetchImpl=async(url,o)=>{calls.push({url,method:o.method});let data;
 if(url.endsWith('/pooler'))data=[{database_type:'PRIMARY',pool_mode:'transaction',db_port:6543,db_host:'aws-1-eu-west-1.pooler.supabase.com',db_name:'postgres',db_user:'postgres.'+REF,connection_string:'postgresql://postgres.'+REF+'@aws-1-eu-west-1.pooler.supabase.com:6543/postgres'}];
 else if(url.endsWith('/secrets'))data=[{name:'UNRELATED',value:'never-return'}];
 else if(url.endsWith('/query')){assert.equal(JSON.parse(o.body).read_only,true);data=ROLES.map(name=>({name,password_unset:true,restricted:true}))}
 else data={ref:REF,region:'eu-west-1',status:'ACTIVE_HEALTHY'};
 return {ok:true,status:200,json:async()=>data}};
 const a=createManagementAdapter({token:'sbp_fc_synthetic',attestation:{secretInventoryApproved:true},fetchImpl});
 const e=await a.inspect();assert.equal(e.secretsWriteAttested,false);assert.deepEqual(e.secretNames,['UNRELATED']);assert.equal(JSON.stringify(e).includes('never-return'),false);
 assert.equal(calls.length,4);assert.ok(calls.every(c=>c.url.startsWith('https://api.supabase.com/v1/projects/'+REF)));
 for(const key of ['setPasswordsIfUnset','createSecretsIfAbsent','verifySecrets','removeOwnedSecrets','clearOwnedPasswords'])await assert.rejects(()=>a[key](),/disabled/);
 assert.equal(calls.length,4);
 const before=calls.length;
 const unapproved=createManagementAdapter({token:'sbp_fc_synthetic',fetchImpl});
 await assert.rejects(()=>unapproved.inspect(),/Separate secret inventory approval required/);
 assert.deepEqual(calls.slice(before).map(c=>c.url),['https://api.supabase.com/v1/projects/'+REF,'https://api.supabase.com/v1/projects/'+REF+'/config/database/pooler']);
 let secretRequests=0;
 const denied=createManagementAdapter({token:'sbp_fc_synthetic',attestation:{secretInventoryApproved:true},fetchImpl:async(url,o)=>url.endsWith('/secrets')?(secretRequests++,{ok:false,status:403}):fetchImpl(url,o)});
 await assert.rejects(()=>denied.inspect(),/403/);
 assert.equal(secretRequests,1);
 assert.throws(()=>createManagementAdapter({token:'classic-token',fetchImpl}));
 console.log('PASS: scoped API, fixed project, read-only SQL, secret redaction, denied writes');
})().catch(()=>{console.error('Management API offline QA failed');process.exitCode=1});
