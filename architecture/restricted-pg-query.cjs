'use strict';
// Each limiter call uses a transaction-scoped role, never a persistent SET ROLE.
// The login has NOINHERIT membership and no direct private table privileges.
const {SQL}=require('./postgres-durable-limiter.cjs');
const LOGIN='aurea_limiter_login', ROLE='aurea_rate_limiter';
function createRestrictedLimiterQuery({pool}={}){
 if(typeof pool?.connect!=='function')throw new TypeError('Missing PostgreSQL pool');
 return async function query(sql,params){
  if(sql!==SQL||!Array.isArray(params)||params.length!==2||typeof params[0]!=='string'||!/^[a-f0-9]{64}$/.test(params[0])||!Number.isSafeInteger(params[1]))throw new TypeError('Unapproved limiter query');
  const client=await pool.connect();
  let committed=false;
  try{
   await client.query('BEGIN');
   // Fixed SQL literal: never interpolate a role from request or environment.
   await client.query('SET LOCAL ROLE aurea_rate_limiter');
   const identity=await client.query("select session_user as login_user, current_user as active_user, r.rolbypassrls as bypassrls from pg_roles r where r.rolname=current_user");
   const row=identity?.rows?.[0];
   if(identity?.rows?.length!==1||row.login_user!==LOGIN||row.active_user!==ROLE||row.bypassrls!==false)throw new Error('Untrusted database identity');
   const result=await client.query(sql,params);
   await client.query('COMMIT');
   committed=true;
   return result;
  }catch(error){
   try{if(!committed)await client.query('ROLLBACK')}catch{}
   throw error;
  }finally{
   // Never reuse a connection whose role/session state cannot be trusted.
   client.release(committed?undefined:true);
  }
 };
}
module.exports={createRestrictedLimiterQuery};
