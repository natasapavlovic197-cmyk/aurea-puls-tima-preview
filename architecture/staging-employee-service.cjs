'use strict';
// Server-only employee composition. No public endpoint, no credentials, no fallback.
// The restricted SQL login can increment rate-limit counters only; the employee
// adapter must be separately authorized by a reviewed trusted server runtime.
const {createRestrictedLimiterQuery}=require('./restricted-pg-query.cjs');
const {createEmployeeDurableRateLimit}=require('./employee-durable-rate-limit.cjs');
const {createEmployeeGateway}=require('./employee-server-gateway.cjs');
function createStagingEmployeeService({pool,limiterSecret,adapter}={}){
 if(typeof pool?.connect!=='function'||typeof limiterSecret!=='string'||limiterSecret.length<32||
    typeof adapter?.invitation!=='function'||typeof adapter?.submit!=='function')
  throw new TypeError('Restricted SQL pool, limiter secret and authorized employee adapter required');
 const query=createRestrictedLimiterQuery({pool});
 const rateLimit=createEmployeeDurableRateLimit({query,secret:limiterSecret});
 return Object.freeze({handler:createEmployeeGateway({adapter,rateLimit})});
}
module.exports={createStagingEmployeeService};
