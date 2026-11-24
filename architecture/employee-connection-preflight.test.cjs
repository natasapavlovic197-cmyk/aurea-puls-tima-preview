'use strict';
const assert=require('node:assert/strict');
const {verifyEmployeeDatabaseAccess}=require('./employee-connection-preflight.cjs');
const {REF}=require('./staging-pooler-config.cjs');
const env={AUREA_SUPABASE_URL:'https://'+REF+'.supabase.co',AUREA_STAGING_DATABASE_HOST:'aws-9-eu-west-1.pooler.supabase.com',AUREA_STAGING_DATABASE_NAME:'postgres',AUREA_STAGING_DATABASE_USER:'aurea_limiter_login.'+REF,AUREA_EMPLOYEE_DATABASE_USER:'aurea_employee_login.'+REF,AUREA_STAGING_DATABASE_PASSWORD:'L'.repeat(32),AUREA_EMPLOYEE_DATABASE_PASSWORD:'E'.repeat(32)};
let ended=0,executed=0,created=0,role='aurea_employee_login',status='unavailable';
class Pool{
 constructor(config){created++;assert.equal(config.user,env.AUREA_EMPLOYEE_DATABASE_USER);assert.equal(config.ssl.rejectUnauthorized,true);assert.equal(config.port,5432)}
 async connect(){return {async query(sql,params){if(sql.includes('session_user as login_user'))return {rows:[{login_user:role,active_user:role,superuser:false,bypassrls:false}]};executed++;assert.match(sql,/public\.aurea_employee_invitation/);assert.deepEqual(params,['0'.repeat(64)]);return {rows:[{result:{status}}]};},release(discard){assert.equal(discard,true)}}}
 async end(){ended++}
}
(async()=>{
 const run=patch=>verifyEmployeeDatabaseAccess({env:{...env,...patch},Pool,readOnlyApproved:true});
 await assert.rejects(()=>verifyEmployeeDatabaseAccess({env,Pool}),/not approved/);
 for(const patch of [{AUREA_B2B_EMPLOYEE_ENABLED:'true'},{AUREA_B2B_MANAGER_DEPLOY_APPROVED:'true'},{AUREA_EMPLOYEE_DATABASE_USER:'postgres'},{AUREA_EMPLOYEE_DATABASE_USER:'aurea_employee_login'},{AUREA_STAGING_DATABASE_HOST:'evil.com'},{AUREA_EMPLOYEE_DATABASE_PASSWORD:env.AUREA_STAGING_DATABASE_PASSWORD}])await assert.rejects(()=>run(patch));
 assert.equal(created,0);
 assert.deepEqual(await run({}),{employeeLoginVerified:true,invalidTokenRejected:true});
 assert.equal(executed,1);assert.equal(ended,1);
 role='postgres';await assert.rejects(()=>run({}),/Untrusted/);assert.equal(executed,1);role='aurea_employee_login';
 status='ready';await assert.rejects(()=>run({}),/Unexpected/);assert.equal(ended,3);
 console.log('PASS: offline read-only employee probe, correct pooler login, TLS, disabled flags, identity and cleanup');
})().catch(e=>{console.error(e);process.exitCode=1});
