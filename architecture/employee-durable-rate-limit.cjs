'use strict';
// Server-only employee throttle. Never trust caller-supplied IP headers.
// Uses the same atomic, HMAC-keyed restricted PostgreSQL counter as manager runtime.
const {createDurableLimiter}=require('./postgres-durable-limiter.cjs');
function createEmployeeDurableRateLimit({query,secret,clock}={}){
 const invitation=createDurableLimiter({query,secret,maxHits:15,windowSeconds:300,clock});
 const submit=createDurableLimiter({query,secret,maxHits:8,windowSeconds:300,clock});
 return async function rateLimit(event,action){
  if(action!=='invitation'&&action!=='submit')return false;
  const ip=event?.requestContext?.identity?.sourceIp;
  if(typeof ip!=='string'||!ip)return false;
  return (action==='invitation'?invitation:submit)({ip,scope:action==='invitation'?'employee-invitation':'employee-submit'});
 };
}
module.exports={createEmployeeDurableRateLimit};
