'use strict';
const assert=require('node:assert/strict');
const {createEmployeeRuntime}=require('./employee-runtime.cjs');
const {REF}=require('./staging-pooler-config.cjs');
const env={
 AUREA_SUPABASE_URL:`https://${REF}.supabase.co`,
 AUREA_B2B_EMPLOYEE_ENABLED:'true',AUREA_B2B_EMPLOYEE_DEPLOY_APPROVED:'true',
 AUREA_STAGING_DATABASE_HOST:'aws-9-eu-west-1.pooler.supabase.com',AUREA_STAGING_DATABASE_NAME:'postgres',
 AUREA_STAGING_DATABASE_USER:`aurea_limiter_login.${REF}`,AUREA_EMPLOYEE_DATABASE_USER:`aurea_employee_login.${REF}`,
 AUREA_STAGING_DATABASE_PASSWORD:'L'.repeat(32),AUREA_EMPLOYEE_DATABASE_PASSWORD:'E'.repeat(32),AUREA_LIMITER_SECRET:'S'.repeat(64)
};
const pools=[];
class FakePool{constructor(config){this.config=config;this.ended=false;pools.push(this)}async connect(){throw Error('not connected in constructor')}async end(){this.ended=true}}
(async()=>{
 assert.throws(()=>createEmployeeRuntime({env:{...env,AUREA_B2B_EMPLOYEE_ENABLED:'false'},Pool:FakePool}),/not approved/);
 assert.throws(()=>createEmployeeRuntime({env:{...env,AUREA_EMPLOYEE_DATABASE_PASSWORD:env.AUREA_STAGING_DATABASE_PASSWORD},Pool:FakePool}),/differ/);
 assert.throws(()=>createEmployeeRuntime({env:{...env,AUREA_EMPLOYEE_DATABASE_USER:'postgres'},Pool:FakePool}),/Restricted/);
 assert.throws(()=>createEmployeeRuntime({env:{...env,AUREA_STAGING_DATABASE_HOST:'attacker.example.com'},Pool:FakePool}),/host/);
 for(const patch of [{AUREA_EMPLOYEE_DATABASE_USER:'aurea_employee_login'},{AUREA_EMPLOYEE_DATABASE_USER:'postgres.'+REF},{AUREA_EMPLOYEE_DATABASE_USER:'aurea_employee_login.foreign'},{AUREA_SUPABASE_URL:'https://foreign.supabase.co'},{AUREA_STAGING_DATABASE_NAME:'other'},{AUREA_STAGING_DATABASE_HOST:'aws-9-eu-west-1.pooler.supabase.com.evil.net'},{AUREA_B2B_EMPLOYEE_DEPLOY_APPROVED:'false'}])assert.throws(()=>createEmployeeRuntime({env:{...env,...patch},Pool:FakePool}));
 assert.equal(pools.length,0);
 const runtime=createEmployeeRuntime({env,Pool:FakePool});
 assert.equal(typeof runtime.handler,'function');
 assert.equal(pools.length,2);
 assert.deepEqual(pools.map(p=>p.config.user),[`aurea_limiter_login.${REF}`,`aurea_employee_login.${REF}`]);
 assert.ok(pools.every(p=>p.config.ssl.rejectUnauthorized===true));
 assert.ok(pools.every(p=>p.config.max===3));
 await runtime.close();assert.ok(pools.every(p=>p.ended));
 console.log('PASS: employee runtime requires explicit approval, distinct restricted logins and TLS');
})().catch(e=>{console.error(e);process.exitCode=1});
