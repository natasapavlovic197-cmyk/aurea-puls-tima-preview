'use strict';
// Dedicated employee RPC executor: no service_role key, no user-controlled SQL.
// Requires a separate LOGIN role with EXECUTE on exactly two reviewed RPCs.
// Not connected to the public Netlify endpoint until real-role tests pass.
const HASH=/^[a-f0-9]{64}$/;
const CODES=/^[A-Za-z0-9_-]{1,32}$/;
const LOGIN='aurea_employee_login';
function createRestrictedEmployeeAdapter({pool}={}){
 if(typeof pool?.connect!=='function')throw new TypeError('Employee-only SQL pool required');
 async function execute(sql,params){
  const client=await pool.connect();
  try{
   const identity=await client.query("select session_user as login_user, current_user as active_user, r.rolsuper as superuser, r.rolbypassrls as bypassrls from pg_roles r where r.rolname=current_user");
   const row=identity?.rows?.[0];
   if(identity?.rows?.length!==1||row.login_user!==LOGIN||row.active_user!==LOGIN||row.superuser!==false||row.bypassrls!==false)throw Error('Untrusted employee database identity');
   const result=await client.query(sql,params);
   if(result?.rows?.length!==1||!result.rows[0]||typeof result.rows[0].result!=='object')throw Error('Invalid employee RPC response');
   return result.rows[0].result;
  }finally{client.release(true)}
 }
 return Object.freeze({
  invitation(hash){
   if(typeof hash!=='string'||!HASH.test(hash))throw new TypeError('Invalid invitation hash');
   return execute('select public.aurea_employee_invitation($1::text) as result',[hash]);
  },
  submit(hash,answers){
   if(typeof hash!=='string'||!HASH.test(hash)||!Array.isArray(answers)||answers.length!==6)throw new TypeError('Invalid employee submission');
   const seen=new Set();
   for(const a of answers){
    if(!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).some(k=>!['code','rating'].includes(k))||
       typeof a.code!=='string'||!CODES.test(a.code)||seen.has(a.code)||!Number.isInteger(a.rating)||a.rating<1||a.rating>6)throw new TypeError('Invalid employee answer');
    seen.add(a.code);
   }
   return execute('select public.aurea_employee_submit($1::text,$2::jsonb) as result',[hash,JSON.stringify(answers)]);
  }
 });
}
module.exports={createRestrictedEmployeeAdapter};
