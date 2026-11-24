'use strict';
// Explicitly approved read-only probe; no runtime, listener, limiter mutation or submit.
const {poolerConfig,REF}=require('./staging-pooler-config.cjs');
const {createRestrictedEmployeeAdapter}=require('./restricted-employee-adapter.cjs');
async function verifyEmployeeDatabaseAccess({env={},Pool,readOnlyApproved=false}={}){
 if(readOnlyApproved!==true||typeof Pool!=='function')throw Error('Read-only probe not approved');
 if(['AUREA_B2B_EMPLOYEE_ENABLED','AUREA_B2B_EMPLOYEE_DEPLOY_APPROVED','AUREA_B2B_MANAGER_ENABLED','AUREA_B2B_MANAGER_DEPLOY_APPROVED'].some(k=>env[k]!==undefined&&env[k]!=='false'))throw Error('Activation flags must remain disabled');
 const config=poolerConfig(env);
 if(env.AUREA_EMPLOYEE_DATABASE_USER!=='aurea_employee_login.'+REF)throw Error('Restricted employee login required');
 const p=env.AUREA_EMPLOYEE_DATABASE_PASSWORD,l=env.AUREA_STAGING_DATABASE_PASSWORD;
 if(typeof p!=='string'||p.length<24||typeof l!=='string'||l.length<24||p===l)throw Error('Distinct restricted credentials required');
 const pool=new Pool({...config,user:env.AUREA_EMPLOYEE_DATABASE_USER,password:p,max:1,connectionTimeoutMillis:4000,idleTimeoutMillis:10000});
 try{
 const result=await createRestrictedEmployeeAdapter({pool}).invitation('0'.repeat(64));
 if(!result||!['unavailable','invalid'].includes(result.status))throw Error('Unexpected invalid-token result');
 return Object.freeze({employeeLoginVerified:true,invalidTokenRejected:true});
 }finally{await pool.end()}
}
module.exports={verifyEmployeeDatabaseAccess};
