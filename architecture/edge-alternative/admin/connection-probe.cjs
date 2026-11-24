'use strict';
const {poolerConfig,REF}=require('../../staging-pooler-config.cjs');
const assert=(ok,msg)=>{if(!ok)throw Error(msg)};
async function probe({env,Pool}={}){
 const c=poolerConfig(env);
 const lp=env.AUREA_STAGING_DATABASE_PASSWORD,ep=env.AUREA_EMPLOYEE_DATABASE_PASSWORD;
 assert(typeof Pool==='function'&&typeof lp==='string'&&lp.length>=24&&typeof ep==='string'&&ep.length>=24&&lp!==ep&&env.AUREA_EMPLOYEE_DATABASE_USER==='aurea_employee_login.'+REF,'Restricted configuration required');
 for(const [login,password,active] of [['aurea_limiter_login',lp,'aurea_rate_limiter'],['aurea_employee_login',ep,'aurea_employee_login']]){
  const pool=new Pool({...c,user:login+'.'+REF,password,max:1,connectionTimeoutMillis:4000});
  let client;
  try{
   client=await pool.connect();
   await client.query('BEGIN READ ONLY');
   const check=async(expected)=>{
    const r=await client.query("select session_user as login_user,current_user as active_user,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication from pg_roles where rolname=current_user");
    const x=r.rows?.[0];
    assert(r.rows?.length===1&&x.login_user===login&&x.active_user===expected&&['rolsuper','rolbypassrls','rolcreatedb','rolcreaterole','rolreplication'].every(k=>x[k]===false),'Restricted identity check failed');
   };
   await check(login);
   const p=await client.query("select has_schema_privilege(current_user,'aurea_private','USAGE') as private_usage,has_table_privilege(current_user,'aurea_private.api_rate_limits','INSERT') as limiter_insert");
   assert(p.rows?.[0]?.private_usage===false&&p.rows[0].limiter_insert===false,'Unexpected direct access');
   if(login==='aurea_limiter_login'){await client.query('SET LOCAL ROLE aurea_rate_limiter');await check(active)}
   else{
    const r=await client.query("select has_function_privilege(current_user,'public.aurea_employee_invitation(text)','EXECUTE') as invitation,has_function_privilege(current_user,'public.aurea_employee_submit(text,jsonb)','EXECUTE') as submit,has_function_privilege(current_user,'public.aurea_manager_publications_v2(uuid)','EXECUTE') as manager");
    assert(r.rows?.[0]?.invitation===true&&r.rows[0].submit===true&&r.rows[0].manager===false,'Unexpected RPC access');
   }
  }finally{if(client){try{await client.query('ROLLBACK')}finally{client.release(true)}}await pool.end()}
 }
 return {status:'pass'};
}
module.exports={probe};
