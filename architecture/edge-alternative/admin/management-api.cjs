'use strict';
const {REF,ROLES,NAMES}=require('./provision.cjs');
const {probe}=require('./connection-probe.cjs');
const assert=(x,m)=>{if(!x)throw Error(m)};
const ROOT='https://api.supabase.com/v1/projects/'+REF;
const ROLE_SQL="select rolname as name, rolpassword is null as password_unset, (rolcanlogin and not rolinherit and not rolsuper and not rolbypassrls and not rolcreatedb and not rolcreaterole and not rolreplication and not has_schema_privilege(rolname,'aurea_private','USAGE')) as restricted from pg_authid where rolname in ('aurea_limiter_login','aurea_employee_login')";
function createManagementAdapter({token,fetchImpl=globalThis.fetch,Pool,attestation={}}={}){
 assert(typeof token==='string'&&token.startsWith('sbp_fc')&&typeof fetchImpl==='function','Scoped token required');
 let inspected=false,host;
 async function request(path,method='GET',body){
  assert(['','/config/database/pooler','/secrets','/database/query'].includes(path),'Endpoint forbidden');
  const r=await fetchImpl(ROOT+path,{method,redirect:'error',signal:AbortSignal.timeout(15000),headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(!r.ok)throw Error('Management API rejected request: HTTP '+r.status);
  return r.status===204?null:await r.json().catch(()=>null);
 }
 const query=q=>request('/database/query','POST',{query:q,read_only:true});
 const list=async()=>{const a=await request('/secrets');assert(Array.isArray(a)&&a.every(x=>typeof x.name==='string'),'Invalid secret metadata');return a.map(x=>x.name)};
 async function inspect(){
  inspected=false;
  const p=await request('');
  assert((p.ref||p.id)===REF&&p.region==='eu-west-1'&&p.status==='ACTIVE_HEALTHY','Wrong project');
  const pool=await request('/config/database/pooler');
  // Accept only a unique explicit session-mode endpoint. Never derive a host from region.
  const rows=Array.isArray(pool)?pool:[pool];
  const matches=rows.filter(x=>x&&x.pool_mode==='session'&&Number(x.db_port)===5432&&/^aws-\d+-eu-west-1\.pooler\.supabase\.com$/.test(x.db_host||''));
  assert(matches.length===1,'Unverified session pooler response');
  host=matches[0].db_host;
  const secretNames=await list();
  const roles=await query(ROLE_SQL);
  assert(Array.isArray(roles),'Invalid role metadata');
  inspected=true;
  return {ref:REF,region:p.region,status:p.status,host,port:5432,secretsRead:true,secretsWriteAttested:attestation.secretsWrite===true,exclusiveWindow:attestation.exclusiveWindow===true,sqlLoggingReviewed:attestation.sqlLoggingReviewed===true,secretNames,roles:roles.map(r=>({name:r.name,passwordUnset:r.password_unset,restricted:r.restricted}))};
 }
 // Provider API does not expose atomic create-if-absent or conditional delete.
 // No mutation is permitted by this adapter until ownership guarantees are independently established.
 const unavailable=async()=>{throw Error('Live mutation disabled: provider ownership and write authorization gate unresolved')};
 return Object.freeze({inspect,setPasswordsIfUnset:unavailable,createSecretsIfAbsent:unavailable,verifySecrets:unavailable,removeOwnedSecrets:unavailable,clearOwnedPasswords:unavailable,async probe({host:requested,limiterPassword,employeePassword}){
  assert(inspected&&requested===host,'Inspect project first');
  return probe({Pool,env:{AUREA_STAGING_DATABASE_HOST:host,AUREA_STAGING_DATABASE_NAME:'postgres',AUREA_STAGING_DATABASE_USER:ROLES[0]+'.'+REF,AUREA_EMPLOYEE_DATABASE_USER:ROLES[1]+'.'+REF,AUREA_SUPABASE_URL:'https://'+REF+'.supabase.co',AUREA_STAGING_DATABASE_PASSWORD:limiterPassword,AUREA_EMPLOYEE_DATABASE_PASSWORD:employeePassword}});
 }});
}
module.exports={createManagementAdapter};
