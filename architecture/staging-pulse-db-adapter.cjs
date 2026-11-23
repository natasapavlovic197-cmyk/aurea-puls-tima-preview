'use strict';
// SERVER ONLY. Inject a restricted PostgreSQL connection (never a browser Supabase client).
// The function is deliberately not deployed or wired to public endpoints until durable
// rate limiting, database privileges, and cross-tenant integration tests are approved.
const SQL='select aurea_private.submit_pulse($1::text,$2::jsonb) as response_id';
function createStagingPulseAdapter({query}={}){
 if(typeof query!=='function')throw new TypeError('A server-side parameterized query adapter is required');
 return Object.freeze({
  async submitPulse(token,answers){
   if(typeof token!=='string'||!Array.isArray(answers)||answers.length!==4)throw new TypeError('Invalid pulse');
   // Parameter binding prevents token/answer interpolation into SQL.
   const result=await query(SQL,[token,JSON.stringify(answers)]);
   const id=result?.rows?.[0]?.response_id;
   if(typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id))throw new Error('Submission not confirmed');
   // Do not return the internal response ID to the employee client.
   return true;
  }
 });
}
module.exports={createStagingPulseAdapter,SQL};
