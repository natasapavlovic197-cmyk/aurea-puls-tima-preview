'use strict';
// Server-only restricted PostgreSQL connection adapter.
// Requires an injected pg-compatible Pool; never imports credentials or uses
// service_role. Verifies the actual SQL session role before every counter query.
const {SQL}=require('./postgres-durable-limiter.cjs');
const ROLE='aurea_rate_limiter';
function createRestrictedLimiterQuery({pool}={}){
 if(typeof pool?.connect!=='function')throw new TypeError('Missing PostgreSQL pool');
 return async function query(sql,params){
  if(sql!==SQL||!Array.isArray(params)||params.length!==2||typeof params[0]!=='string'||!/^[a-f0-9]{64}$/.test(params[0])||!Number.isSafeInteger(params[1]))throw new TypeError('Unapproved limiter query');
  const client=await pool.connect();
  try{
   const role=await client.query("select current_user as current_user, current_setting('role',true) as session_role, r.rolbypassrls as bypassrls from pg_roles r where r.rolname=current_user");
   const row=role?.rows?.[0];
   if(role?.rows?.length!==1||row.current_user!==ROLE||row.bypassrls!==false)throw new Error('Untrusted database identity');
   return await client.query(sql,params);
  }finally{client.release()}
 };
}
module.exports={createRestrictedLimiterQuery};
