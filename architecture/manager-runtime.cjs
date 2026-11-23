'use strict';
// Server-only composition. A deployment must explicitly supply a restricted
// PostgreSQL query function; no secret keys, bypass role or in-memory fallback.
const {createManagerBridge}=require('./supabase-manager-bridge.cjs');
const {createDurableLimiter}=require('./postgres-durable-limiter.cjs');
const {createManagerEndpoint}=require('./manager-live-endpoint.cjs');
function createManagerRuntime({supabaseUrl,publishableKey,fetchImpl,query,limiterSecret}={}){
 if(typeof query!=='function'||typeof limiterSecret!=='string'||limiterSecret.length<32)throw new TypeError('Missing restricted database runtime');
 const bridge=createManagerBridge({url:supabaseUrl,key:publishableKey,fetchImpl});
 const limit=createDurableLimiter({query,secret:limiterSecret,maxHits:20,windowSeconds:300});
 return createManagerEndpoint({bridge,limit});
}
module.exports={createManagerRuntime};
