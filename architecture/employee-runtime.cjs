'use strict';
// Private runtime only. Requires two distinct restricted PostgreSQL credentials.
// No connection is opened and no endpoint is enabled until explicit approval.
const {createStagingEmployeeService}=require('./staging-employee-service.cjs');
const {createRestrictedEmployeeAdapter}=require('./restricted-employee-adapter.cjs');
function createEmployeeRuntime({env,Pool}={}){
 if(!env||typeof Pool!=='function')throw new TypeError('Server environment and PostgreSQL Pool required');
 if(env.AUREA_B2B_EMPLOYEE_ENABLED!=='true'||env.AUREA_B2B_EMPLOYEE_DEPLOY_APPROVED!=='true')throw new TypeError('Employee runtime not approved');
 const keys=['AUREA_STAGING_DATABASE_HOST','AUREA_STAGING_DATABASE_NAME','AUREA_STAGING_DATABASE_PASSWORD','AUREA_EMPLOYEE_DATABASE_PASSWORD','AUREA_LIMITER_SECRET'];
 if(keys.some(k=>typeof env[k]!=='string'||!env[k]))throw new TypeError('Missing employee server configuration');
 if(env.AUREA_STAGING_DATABASE_USER!=='aurea_limiter_login'||env.AUREA_EMPLOYEE_DATABASE_USER!=='aurea_employee_login')throw new TypeError('Restricted database logins required');
 if(!/^[a-z0-9.-]+$/i.test(env.AUREA_STAGING_DATABASE_HOST)||!env.AUREA_STAGING_DATABASE_HOST.endsWith('.supabase.com'))throw new TypeError('Unexpected database host');
 if(env.AUREA_STAGING_DATABASE_PASSWORD.length<24||env.AUREA_EMPLOYEE_DATABASE_PASSWORD.length<24||env.AUREA_LIMITER_SECRET.length<32)throw new TypeError('Weak credentials');
 if(env.AUREA_STAGING_DATABASE_PASSWORD===env.AUREA_EMPLOYEE_DATABASE_PASSWORD)throw new TypeError('Database credentials must differ');
 const options={host:env.AUREA_STAGING_DATABASE_HOST,port:5432,database:env.AUREA_STAGING_DATABASE_NAME,ssl:{rejectUnauthorized:true},max:3,connectionTimeoutMillis:4000,idleTimeoutMillis:10000};
 const limiterPool=new Pool({...options,user:'aurea_limiter_login',password:env.AUREA_STAGING_DATABASE_PASSWORD});
 let employeePool;
 try{
  employeePool=new Pool({...options,user:'aurea_employee_login',password:env.AUREA_EMPLOYEE_DATABASE_PASSWORD});
  const adapter=createRestrictedEmployeeAdapter({pool:employeePool});
  const service=createStagingEmployeeService({pool:limiterPool,limiterSecret:env.AUREA_LIMITER_SECRET,adapter});
  return Object.freeze({handler:service.handler,close:async()=>{await Promise.allSettled([limiterPool.end(),employeePool.end()])}});
 }catch(e){void limiterPool.end().catch(()=>{});if(employeePool)void employeePool.end().catch(()=>{});throw e}
}
module.exports={createEmployeeRuntime};
