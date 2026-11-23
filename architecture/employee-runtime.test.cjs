'use strict';
const assert=require('node:assert/strict');
const {createEmployeeRuntime}=require('./employee-runtime.cjs');
const env={
 AUREA_B2B_EMPLOYEE_ENABLED:'true',AUREA_B2B_EMPLOYEE_DEPLOY_APPROVED:'true',
 AUREA_STAGING_DATABASE_HOST:'db.example.supabase.com',AUREA_STAGING_DATABASE_NAME:'postgres',
 AUREA_STAGING_DATABASE_USER:'aurea_limiter_login',AUREA_EMPLOYEE_DATABASE_USER:'aurea_employee_login',
 AUREA_STAGING_DATABASE_PASSWORD:'L'.repeat(32),AUREA_EMPLOYEE_DATABASE_PASSWORD:'E'.repeat(32),AUREA_LIMITER_SECRET:'S'.repeat(64)
};
const pools=[];
class FakePool{constructor(config){this.config=config;this.ended=false;pools.push(this)}async connect(){throw Error('not connected in constructor')}async end(){this.ended=true}}
(async()=>{
 assert.throws(()=>createEmployeeRuntime({env:{...env,AUREA_B2B_EMPLOYEE_ENABLED:'false'},Pool:FakePool}),/not approved/);
 assert.throws(()=>createEmployeeRuntime({env:{...env,AUREA_EMPLOYEE_DATABASE_PASSWORD:env.AUREA_STAGING_DATABASE_PASSWORD},Pool:FakePool}),/differ/);
 assert.throws(()=>createEmployeeRuntime({env:{...env,AUREA_EMPLOYEE_DATABASE_USER:'postgres'},Pool:FakePool}),/Restricted/);
 assert.throws(()=>createEmployeeRuntime({env:{...env,AUREA_STAGING_DATABASE_HOST:'attacker.example.com'},Pool:FakePool}),/host/);
 assert.equal(pools.length,0);
 const runtime=createEmployeeRuntime({env,Pool:FakePool});
 assert.equal(typeof runtime.handler,'function');
 assert.equal(pools.length,2);
 assert.deepEqual(pools.map(p=>p.config.user),['aurea_limiter_login','aurea_employee_login']);
 assert.ok(pools.every(p=>p.config.ssl.rejectUnauthorized===true));
 assert.ok(pools.every(p=>p.config.max===3));
 await runtime.close();assert.ok(pools.every(p=>p.ended));
 console.log('PASS: employee runtime requires explicit approval, distinct restricted logins and TLS');
})().catch(e=>{console.error(e);process.exitCode=1});
