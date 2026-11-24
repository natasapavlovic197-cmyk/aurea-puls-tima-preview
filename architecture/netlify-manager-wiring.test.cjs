'use strict';
const assert=require('node:assert/strict');
const {createHandler}=require('../netlify/functions/aurea-manager-summary.cjs');
const org='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const base={AUREA_B2B_MANAGER_ENABLED:'true',AUREA_B2B_MANAGER_DEPLOY_APPROVED:'true',AUREA_STAGING_DATABASE_HOST:'aws-9-eu-west-1.pooler.supabase.com',AUREA_STAGING_DATABASE_NAME:'postgres',AUREA_STAGING_DATABASE_USER:'aurea_limiter_login.ublzmoroanhlcgpnxilw',AUREA_STAGING_DATABASE_PASSWORD:'p'.repeat(40),AUREA_LIMITER_SECRET:'s'.repeat(64),AUREA_SUPABASE_URL:'https://ublzmoroanhlcgpnxilw.supabase.co',AUREA_SUPABASE_PUBLISHABLE_KEY:'test-publishable'};
const event={httpMethod:'GET',queryStringParameters:{organization_id:org},requestContext:{identity:{sourceIp:'192.0.2.8'}},headers:{authorization:'Bearer a.b.c'}};
let calls=0,fetches=0;
class Pool{async connect(){return {async query(sql){if(sql.includes('session_user as login_user'))return {rows:[{login_user:'aurea_limiter_login',active_user:'aurea_rate_limiter',bypassrls:false}]};return {rows:[{hits:1}]}},release(){}}}async end(){}}
const fetchImpl=async(url)=>{fetches++;if(url.endsWith('/auth/v1/user'))return {ok:true,json:async()=>({id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'})};return {ok:true,json:async()=>[{week_start:'2026-11-23',domain:'clarity',question_code:'Q1',response_count:6,favorable_percent:75}]}};
(async()=>{
 for(const changes of [{AUREA_B2B_MANAGER_ENABLED:'false'},{AUREA_B2B_MANAGER_DEPLOY_APPROVED:'false'},{AUREA_STAGING_DATABASE_PASSWORD:''}]){
  const h=createHandler({env:{...base,...changes},loadPool:()=>{calls++;return Pool},fetchImpl});
  assert.equal((await h(event)).statusCode,503);
 }
 assert.equal(calls,1,'disabled endpoint never imports DB driver');
 const missing=createHandler({env:base,loadPool:()=>{throw Error('pg driver missing')},fetchImpl});
 assert.equal((await missing(event)).statusCode,503);
 const h=createHandler({env:base,loadPool:()=>Pool,fetchImpl});
 const r=await h(event);assert.equal(r.statusCode,200);assert.equal(JSON.parse(r.body).report[0].favorablePercent,75);
 assert.equal(fetches,2);
 console.log('PASS: dual deployment gate, missing driver and secrets fail closed, approved mock runtime returns aggregate only');
})().catch(e=>{console.error(e);process.exitCode=1});
