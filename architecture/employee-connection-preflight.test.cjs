'use strict';
const assert=require('node:assert/strict');
const {verifyEmployeeDatabaseAccess}=require('./employee-connection-preflight.cjs');
const env={AUREA_B2B_EMPLOYEE_ENABLED:'true',AUREA_B2B_EMPLOYEE_DEPLOY_APPROVED:'true',AUREA_STAGING_DATABASE_HOST:'db.example.supabase.com',AUREA_STAGING_DATABASE_NAME:'postgres',AUREA_STAGING_DATABASE_USER:'aurea_limiter_login',AUREA_EMPLOYEE_DATABASE_USER:'aurea_employee_login',AUREA_STAGING_DATABASE_PASSWORD:'L'.repeat(32),AUREA_EMPLOYEE_DATABASE_PASSWORD:'E'.repeat(32),AUREA_LIMITER_SECRET:'S'.repeat(64)};
let ended=0,executed=0;
class Pool{
 constructor(config){this.config=config}
 async connect(){return {async query(sql,params){if(sql.includes('session_user as login_user'))return {rows:[{login_user:'aurea_employee_login',active_user:'aurea_employee_login',superuser:false,bypassrls:false}]};executed++;assert.deepEqual(params,['0'.repeat(64)]);return {rows:[{result:{status:'unavailable'}}]};},release(discard){assert.equal(discard,true)}}}
 async end(){ended++}
}
(async()=>{
 const result=await verifyEmployeeDatabaseAccess({env,Pool});
 assert.deepEqual(result,{employeeLoginVerified:true,invalidTokenRejected:true});
 assert.equal(executed,1);assert.equal(ended,3);
 await assert.rejects(()=>verifyEmployeeDatabaseAccess({env:{...env,AUREA_B2B_EMPLOYEE_ENABLED:'false'},Pool}),/not approved/);
 console.log('PASS: read-only employee preflight verifies login and rejects invalid invitation');
})().catch(e=>{console.error(e);process.exitCode=1});
