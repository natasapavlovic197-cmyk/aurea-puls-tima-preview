'use strict';
const {createManagerWorkspaceRuntime}=require('./manager-runtime.cjs');
function createServerEntry({env,query,fetchImpl}={}){
 let runtime;
 return async function handler(event){
  try{
   if(!runtime)runtime=createManagerWorkspaceRuntime({
    supabaseUrl:env?.AUREA_SUPABASE_URL,
    publishableKey:env?.AUREA_SUPABASE_PUBLISHABLE_KEY,
    limiterSecret:env?.AUREA_LIMITER_SECRET,
    query,fetchImpl
   });
   return await runtime(event);
  }catch{
   return {statusCode:503,headers:{'content-type':'application/json','cache-control':'no-store'},body:JSON.stringify({status:'unavailable'})};
  }
 };
}
module.exports={createServerEntry};
