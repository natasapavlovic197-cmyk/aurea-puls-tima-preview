'use strict';
const assert=require('node:assert/strict');
const {provision,verifier,REF,ROLES,NAMES}=require('./provision.cjs');
const {probe}=require('./connection-probe.cjs');
const evidence={ref:REF,region:'eu-west-1',status:'ACTIVE_HEALTHY',host:'aws-1-eu-west-1.pooler.supabase.com',port:5432,secretsRead:true,secretsWriteAttested:true,exclusiveWindow:true,sqlLoggingReviewed:true,ownershipRollbackVerified:true,flagsDisabled:true,secretNames:[],roles:ROLES.map(name=>({name,passwordUnset:true,restricted:true}))};
(async()=>{
 assert.match(verifier('synthetic'),/^SCRAM-SHA-256\$4096:/);
 let writes=0,undo=0,masked=[];
 const adapter={inspect:async()=>evidence,setPasswordsIfUnset:async()=>{writes++},probe:async()=>{},createSecretsIfAbsent:async()=>{writes++},verifySecrets:async()=>{},removeOwnedSecrets:async()=>{undo++},clearOwnedPasswords:async()=>{undo++}};
 const run=a=>provision({adapter:a,approval:'PROVISION AUREA STAGING ONLY',mask:x=>masked.push(x)});
 await assert.rejects(()=>run({...adapter,inspect:async()=>({...evidence,secretsWriteAttested:false})}));assert.equal(writes,0);
 await assert.rejects(()=>run({...adapter,inspect:async()=>({...evidence,secretNames:[NAMES[0]]})}));assert.equal(writes,0);
 await assert.rejects(()=>run({...adapter,inspect:async()=>({...evidence,roles:[]})}));assert.equal(writes,0);
 assert.equal((await run(adapter)).status,'provisioned');assert.equal(writes,2);assert.equal(new Set(masked).size,5);
 await assert.rejects(()=>run({...adapter,verifySecrets:async()=>{throw Error('synthetic')}}),/rollback verified/);assert.equal(undo,2);
 await assert.rejects(()=>run({...adapter,verifySecrets:async()=>{throw Error('synthetic')},removeOwnedSecrets:async()=>{throw Error('synthetic')}}),/Rollback incomplete/);
 const env={AUREA_STAGING_DATABASE_HOST:evidence.host,AUREA_STAGING_DATABASE_NAME:'postgres',AUREA_STAGING_DATABASE_USER:ROLES[0]+'.'+REF,AUREA_EMPLOYEE_DATABASE_USER:ROLES[1]+'.'+REF,AUREA_SUPABASE_URL:'https://'+REF+'.supabase.co',AUREA_STAGING_DATABASE_PASSWORD:'a'.repeat(32),AUREA_EMPLOYEE_DATABASE_PASSWORD:'b'.repeat(32)};
 let closed=0;class Pool{constructor(c){assert.equal(c.ssl.rejectUnauthorized,true);this.login=c.user.split('.')[0]}async connect(){let active=this.login;const login=this.login;return {release(){},async query(q){if(q.startsWith('SET LOCAL'))active='aurea_rate_limiter';if(q.includes('pg_roles'))return {rows:[{login_user:login,active_user:active,rolsuper:false,rolbypassrls:false,rolcreatedb:false,rolcreaterole:false,rolreplication:false}]};return {rows:[{private_usage:false,limiter_insert:false,invitation:true,submit:true,manager:false}]}}}}async end(){closed++}}
 assert.equal((await probe({env,Pool})).status,'pass');assert.equal(closed,2);
 await assert.rejects(()=>probe({env:{...env,AUREA_EMPLOYEE_DATABASE_USER:'postgres'},Pool}));
 console.log('PASS: offline provisioning guards, rollback, restricted connection probe');
})().catch(()=>{console.error('Offline admin QA failed');process.exitCode=1});
