'use strict';
// Netlify serverless entrypoint. Intentionally FAILS CLOSED until a durable
// cross-instance rate limiter and deployment approval are configured.
// Never add service_role credentials or allow a browser-provided role.
const {createManagerBridge}=require('../../architecture/supabase-manager-bridge.cjs');
const deny=()=>({statusCode:503,headers:{'content-type':'application/json','cache-control':'no-store'},body:JSON.stringify({message:'Service unavailable'})});
exports.handler=async(event)=>{
 if(process.env.AUREA_B2B_MANAGER_ENABLED!=='true')return deny();
 // A shared, durable limiter is mandatory. No in-memory counters permitted.
 // Future adapter must be implemented and independently tested before enabling.
 return deny();
};
