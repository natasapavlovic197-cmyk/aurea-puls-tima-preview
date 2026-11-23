'use strict';
const {createHmac,createHash}=require('node:crypto');
const {createDeliveryPipeline}=require('./weekly-delivery-pipeline.cjs');
const LOGIN='aurea_delivery_login';
const PROJECT='ublzmoroanhlcgpnxilw';
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const id=x=>Number.isSafeInteger(x)&&x>0;
const week=x=>{if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x))return false;const d=new Date(x+'T12:00:00Z');return Number.isFinite(+d)&&d.getUTCDay()===1&&d.toISOString().slice(0,10)===x};
const action=x=>['invite','reminder','report'].includes(x);
const identitySQL="select session_user as login_user,current_user as active_user,r.rolbypassrls as bypassrls,r.rolsuper as superuser,r.rolcreaterole as createrole,r.rolcreatedb as createdb,coalesce((select ssl from pg_stat_ssl where pid=pg_backend_pid()),false) as tls from pg_roles r where r.rolname=current_user";
const allowed=new Map([
 ['select id,organization_id,week_start,action,lease_token from aurea_private.claim_weekly_delivery_job($1::uuid)',[uuid]],
 ['select aurea_private.finish_weekly_delivery_job($1::bigint,$2::uuid,true) as finished',[id,uuid]],
 ['select aurea_private.finish_weekly_delivery_job($1::bigint,$2::uuid,false) as finished',[id,uuid]],
 ['select aurea_private.delivery_snapshot($1::bigint,$2::uuid,$3::uuid,$4::date,$5::text) as snapshot',[id,uuid,uuid,week,action]],
 ['select * from aurea_private.delivery_publications($1::bigint,$2::uuid,$3::uuid,$4::date)',[id,uuid,uuid,week]],
 ['select aurea_private.reserve_recipient_delivery($1::bigint,$2::uuid,$3::uuid,$4::text) as state',[id,uuid,uuid,hex]],
 ['select aurea_private.finish_recipient_delivery($1::bigint,$2::uuid,$3::text,$4::text,$5::boolean) as finished',[id,uuid,hex,x=>x===null||(typeof x==='string'&&x.trim().length>0&&x.length<=512),x=>typeof x==='boolean']],
 ['select aurea_private.persist_weekly_digest($1::bigint,$2::uuid,$3::jsonb) as finished',[id,uuid,x=>typeof x==='string'&&x.length<=65536]]
]);
function createRestrictedDeliveryPool({pool}={}){
 if(typeof pool?.connect!=='function')throw TypeError('Dedicated pool required');
 return {async query(sql,params){
  const checks=allowed.get(sql);
  if(!checks||!Array.isArray(params)||params.length!==checks.length||!checks.every((f,i)=>f(params[i])))throw TypeError('Unapproved delivery query');
  if(sql.includes('finish_recipient_delivery')&&((params[4]&&params[3]===null)||(!params[4]&&params[3]!==null)))throw TypeError('Invalid delivery outcome');
  const client=await pool.connect();let committed=false;
  try{
   await client.query('BEGIN');
   const result=await client.query(identitySQL),row=result?.rows?.[0];
   if(result?.rows?.length!==1||row.login_user!==LOGIN||row.active_user!==LOGIN||row.bypassrls!==false||row.superuser!==false||row.createrole!==false||row.createdb!==false||row.tls!==true)throw Error('Untrusted delivery connection');
   const value=await client.query(sql,params);
   await client.query('COMMIT');committed=true;return value;
  }catch{try{await client.query('ROLLBACK')}catch{}throw Error('Delivery database operation failed')}
  finally{client.release(committed?undefined:true)}
 }};
}
// Deterministic scoped token for NEW invitations only. Persist only hash at issuance.
// Existing randomly issued hashes cannot be recovered; store rejects any mismatch.
function createInvitationTokenSource(secret){
 if(!hex(secret)||/^0+$/.test(secret))throw TypeError('Missing invitation secret');
 const key=Buffer.from(secret,'hex');
 function resolveInvitationToken({organizationId,weekStart,invitationId}={}){
  if(!uuid(organizationId)||!week(weekStart)||!uuid(invitationId))throw TypeError('Invalid invitation scope');
  return createHmac('sha256',key).update(JSON.stringify(['aurea-invitation-v1',organizationId.toLowerCase(),weekStart,invitationId.toLowerCase()])).digest('hex');
 }
 return {resolveInvitationToken,hashForIssuance:scope=>createHash('sha256').update(resolveInvitationToken(scope)).digest('hex')};
}
function readDeliveryConfig(env){
 const host=env.AUREA_DELIVERY_DB_HOST,port=env.AUREA_DELIVERY_DB_PORT,user=env.AUREA_DELIVERY_DB_USER,password=env.AUREA_DELIVERY_DB_PASSWORD,ca=env.AUREA_DELIVERY_DB_CA;
 const direct=host==='db.'+PROJECT+'.supabase.co';
 const pooler=typeof host==='string'&&/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.pooler\.supabase\.com$/.test(host);
 if(!(direct||pooler)||port!=='5432'||user!==(direct?LOGIN:LOGIN+'.'+PROJECT)||env.AUREA_DELIVERY_DB_NAME!=='postgres'||typeof password!=='string'||!password.trim()||typeof ca!=='string'||!ca.includes('-----BEGIN CERTIFICATE-----'))throw TypeError('Invalid staging delivery configuration');
 return {host,port:5432,user,password,database:'postgres',ssl:{ca,rejectUnauthorized:true,servername:host},max:2,connectionTimeoutMillis:5000,statement_timeout:15000};
}
// No provider or driver dependency imported; runtime must inject an approved Pool.
// This factory refuses activation: B2 must establish a real authenticated session first.
function prepareDeliveryServer({env={},Pool,provider,origin,clock}={}){
 if(env.AUREA_DELIVERY_ENABLED==='true'||env.AUREA_DELIVERY_DEPLOY_APPROVED==='true')throw Error('Delivery activation not approved');
 if(typeof Pool!=='function')throw TypeError('Approved PostgreSQL driver required');
 const config=readDeliveryConfig(env);
 const tokens=createInvitationTokenSource(env.AUREA_INVITATION_HMAC_SECRET);
 const raw=new Pool(config),pool=createRestrictedDeliveryPool({pool:raw});
 return {processNext:createDeliveryPipeline({pool,resolveInvitationToken:tokens.resolveInvitationToken,provider,origin,clock,enabled:false}),close:()=>raw.end()};
}
module.exports={readDeliveryConfig,createRestrictedDeliveryPool,createInvitationTokenSource,prepareDeliveryServer};
