'use strict';
const assert=require('node:assert/strict');
const {createStagingManagerService}=require('./staging-manager-service.cjs');
const env={AUREA_STAGING_DATABASE_HOST:'db.example.supabase.com',AUREA_STAGING_DATABASE_NAME:'postgres',AUREA_STAGING_DATABASE_USER:'aurea_limiter_login',AUREA_STAGING_DATABASE_PASSWORD:'s'.repeat(40),AUREA_LIMITER_SECRET:'x'.repeat(64),AUREA_SUPABASE_URL:'https://example.supabase.co',AUREA_SUPABASE_PUBLISHABLE_KEY:'publishable-test',AUREA_B2B_MANAGER_ENABLED:'true'};
let config,ended=false;
class Pool{constructor(c){config=c}async connect(){return {query:async(sql)=>sql.includes('session_user as login_user')?{rows:[{login_user:'aurea_limiter_login',active_user:'aurea_rate_limiter',bypassrls:false}]}:{rows:[{hits:1}]},release(){}}}async end(){ended=true}}
(async()=>{
 assert.throws(()=>createStagingManagerService({env:{...env,AUREA_STAGING_DATABASE_USER:'postgres'},Pool}),/Restricted/);
 assert.throws(()=>createStagingManagerService({env:{...env,AUREA_B2B_MANAGER_ENABLED:'false'},Pool}),/approved/);
 assert.throws(()=>createStagingManagerService({env:{...env,AUREA_STAGING_DATABASE_HOST:'evil.com'},Pool}),/host/);
 assert.throws(()=>createStagingManagerService({env:{...env,AUREA_STAGING_DATABASE_PASSWORD:'short'},Pool}),/Weak/);
 const service=createStagingManagerService({env,Pool,fetchImpl:async(url)=>url.endsWith('/auth/v1/user')?{ok:true,json:async()=>({id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'})}:{ok:true,json:async()=>[{week_start:'2026-11-23',question_code:'Q1',domain:'clarity',response_count:6,favorable_percent:80}]}}); 
 assert.equal(config.user,'aurea_limiter_login');assert.equal(config.ssl.rejectUnauthorized,true);assert.equal(config.max,3);
 const r=await service.handler({httpMethod:'GET',queryStringParameters:{organization_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},requestContext:{identity:{sourceIp:'192.0.2.8'}},headers:{authorization:'Bearer a.b.c'}});
 assert.equal(r.statusCode,200);await service.close();assert.equal(ended,true);
 console.log('PASS: restricted DB bootstrap, strict TLS, no admin fallback, manager request and clean shutdown');
})().catch(e=>{console.error(e);process.exitCode=1});
