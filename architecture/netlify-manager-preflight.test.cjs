'use strict';
const assert=require('node:assert/strict');
const {createHandler}=require('../netlify/functions/aurea-manager-summary.cjs');
const env={AUREA_B2B_MANAGER_ENABLED:'true',AUREA_B2B_MANAGER_DEPLOY_APPROVED:'true',AUREA_STAGING_DATABASE_HOST:'db.example.supabase.com',AUREA_STAGING_DATABASE_NAME:'postgres',AUREA_STAGING_DATABASE_USER:'postgres',AUREA_STAGING_DATABASE_PASSWORD:'secret'.repeat(8),AUREA_LIMITER_SECRET:'x'.repeat(64),AUREA_SUPABASE_URL:'https://example.supabase.co',AUREA_SUPABASE_PUBLISHABLE_KEY:'test'};
const event={httpMethod:'GET',queryStringParameters:{organization_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},requestContext:{identity:{sourceIp:'192.0.2.7'}},headers:{authorization:'Bearer a.b.c'}};
(async()=>{
 let poolCreated=0,networkCalls=0;
 class Pool{constructor(){poolCreated++}}
 const h=createHandler({env,loadPool:()=>Pool,fetchImpl:async()=>{networkCalls++;throw Error('should not be reached')}});
 assert.equal((await h(event)).statusCode,503);
 assert.equal(poolCreated,0,'preflight must prevent creating a privileged DB pool');
 assert.equal(networkCalls,0);
 const disabled=createHandler({env:{...env,AUREA_B2B_MANAGER_DEPLOY_APPROVED:'false'},loadPool:()=>{throw Error('driver must not load')}});
 assert.equal((await disabled(event)).statusCode,503);
 console.log('PASS: real Netlify handler rejects privileged DB user before creating pool or issuing network calls');
})().catch(e=>{console.error(e);process.exitCode=1});
