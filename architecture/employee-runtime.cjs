'use strict';
// Private runtime only. Requires two distinct restricted PostgreSQL credentials.
// No connection is opened and no endpoint is enabled until explicit approval.
const {createStagingEmployeeService}=require('./staging-employee-service.cjs');
const {poolerConfig,REF}=require('./staging-pooler-config.cjs');
const {createRestrictedEmployeeAdapter}=require('./restricted-employee-adapter.cjs');
function createEmployeeRuntime({env,Pool}={}){
 if(!env||typeof Pool!=='function')throw new TypeError('Server environment and PostgreSQL Pool required');
 if(env.AUREA_B2B_EMPLOYEE_ENABLED!=='true'||env.AUREA_B2B_EMPLOYEE_DEPLOY_APPROVED!=='true')throw new TypeError('Employee runtime not approved');
 const keys=['AUREA_STAGING_DATABASE_HOST','AUREA_STAGING_DATABASE_NAME','AUREA_STAGING_DATABASE_PASSWORD','AUREA_EMPLOYEE_DATABASE_PASSWORD','AUREA_LIMITER_SECRET'];
 if(keys.some(k=>typeof env[k]!=='string'||!env[k]))throw new TypeError('Missing employee server configuration');
 const config=poolerConfig(env);
 if(env.AUREA_EMPLOYEE_DATABASE_USER!==`aurea_employee_login.${REF}`)throw new TypeError('Restricted employee pooler login required');
 if(env.AUREA_STAGING_DATABASE_PASSWORD.length<24||env.AUREA_EMPLOYEE_DATABASE_PASSWORD.length<24||env.AUREA_LIMITER_SECRET.length<32)throw new TypeError('Weak credentials');
 if(env.AUREA_STAGING_DATABASE_PASSWORD===env.AUREA_EMPLOYEE_DATABASE_PASSWORD)throw new TypeError('Database credentials must differ');
 const options={...config,max:3,connectionTimeoutMillis:4000,idleTimeoutMillis:10000};
 const limiterPool=new Pool({...options,user:config.user,password:env.AUREA_STAGING_DATABASE_PASSWORD});
 let employeePool;
 try{
  employeePool=new Pool({...options,user:env.AUREA_EMPLOYEE_DATABASE_USER,password:env.AUREA_EMPLOYEE_DATABASE_PASSWORD});
  const adapter=createRestrictedEmployeeAdapter({pool:employeePool});
  const service=createStagingEmployeeService({pool:limiterPool,limiterSecret:env.AUREA_LIMITER_SECRET,adapter});
  return Object.freeze({handler:service.handler,close:async()=>{await Promise.allSettled([limiterPool.end(),employeePool.end()])}});
 }catch(e){void limiterPool.end().catch(()=>{});if(employeePool)void employeePool.end().catch(()=>{});throw e}
}
module.exports={createEmployeeRuntime};
