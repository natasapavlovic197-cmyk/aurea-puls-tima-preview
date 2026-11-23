'use strict';
const {randomUUID,createHash,timingSafeEqual}=require('node:crypto');
const {normalizePublications}=require('./publication-row-adapter.cjs');
// This adapter requires a dedicated database login with narrowly scoped EXECUTE
// permissions on private delivery functions. Never use an employee or manager pool.
function createWeeklyDeliveryStore({pool,resolveInvitationToken}={}){
 if(typeof pool?.query!=='function')throw new TypeError('Dedicated PostgreSQL pool required');
 return {
  async loadScopedRecipients(job){
   const args=fullScope(job);
   const r=await pool.query('select aurea_private.delivery_snapshot($1::bigint,$2::uuid,$3::uuid,$4::date,$5::text) as snapshot',args);
   const s=r?.rows?.length===1?r.rows[0].snapshot:null;
   if(!s||typeof s.cycleClosed!=='boolean'||!Array.isArray(s.recipients)||s.recipients.length>10000||s.cycleClosed!==(job.action==='report'))throw Error('Invalid delivery snapshot');
   const recipients=[];
   for(const row of s.recipients){
    if(!isUuid(row?.id)||typeof row.email!=='string')throw Error('Invalid recipient source');
    const base={id:row.id,email:row.email,organizationId:job.organizationId,weekStart:job.weekStart};
    if(job.action==='report'){
     if(!['owner','manager'].includes(row.role)||row.active!==true)throw Error('Invalid manager recipient');
     recipients.push({...base,role:row.role,active:true});continue;
    }
    if(typeof resolveInvitationToken!=='function'||!validKey(row.tokenHash))throw Error('Invitation token source unavailable');
    const token=await resolveInvitationToken({organizationId:job.organizationId,weekStart:job.weekStart,invitationId:row.id});
    if(!validKey(token)||!timingSafeEqual(Buffer.from(row.tokenHash,'hex'),createHash('sha256').update(token).digest()))throw Error('Invitation token verification failed');
    recipients.push({...base,token,expiresAt:row.expiresAt,sentAt:row.sentAt,reminderAt:row.reminderAt,redeemedAt:row.redeemedAt});
   }
   return {cycleClosed:s.cycleClosed,recipients};
  },
  async loadPublications(job){
   const args=fullScope(job);
   if(job.action!=='report')throw Error('Invalid report action');
   const r=await pool.query('select * from aurea_private.delivery_publications($1::bigint,$2::uuid,$3::uuid,$4::date)',args.slice(0,4));
   return normalizePublications(r?.rows).map(row=>{
    if(row.weekStart>job.weekStart)throw Error('Future publication');
    return {...row,organizationId:job.organizationId};
   });
  },
  async reserve({job,recipientId,key}){
   const [id,token]=scope(job);
   if(!isUuid(recipientId)||!validKey(key))throw TypeError('Invalid recipient reservation');
   const r=await pool.query('select aurea_private.reserve_recipient_delivery($1::bigint,$2::uuid,$3::uuid,$4::text) as state',[id,token,recipientId,key]);
   const state=r?.rows?.length===1?r.rows[0].state:null;
   if(!['reserved','confirmed','ineligible','blocked'].includes(state))throw Error('Invalid reservation result');
   return state;
  },
  async confirm({job,key,providerId}){
   if(typeof providerId!=='string'||!providerId.trim()||providerId.length>512)throw TypeError('Invalid provider id');
   return finishRecipient(job,key,providerId,true);
  },
  async markUncertain({job,key}){return finishRecipient(job,key,null,false);},
  async publishDigest({job,digest}){
   const [id,token]=scope(job);
   if(job.action!=='report'||!digest||digest.weekStart!==job.weekStart)throw TypeError('Invalid digest scope');
   const r=await pool.query('select aurea_private.persist_weekly_digest($1::bigint,$2::uuid,$3::jsonb) as finished',[id,token,JSON.stringify(digest)]);
   return r?.rows?.length===1&&r.rows[0].finished===true;
  },
  async claim(){
   const token=randomUUID();
   const r=await pool.query(
    'select id,organization_id,week_start,action,lease_token from aurea_private.claim_weekly_delivery_job($1::uuid)',
    [token]);
   if(!Array.isArray(r?.rows)||r.rows.length>1)throw Error('Invalid claim result');
   if(!r.rows.length)return null;
   const j=r.rows[0];
   if(String(j.lease_token)!==token)throw Error('Lease token mismatch');
   const date=typeof j.week_start==='string'?j.week_start:j.week_start instanceof Date?j.week_start.toISOString().slice(0,10):null;
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))throw Error('Invalid week start');
   return {id:Number(j.id),organizationId:j.organization_id,weekStart:date,action:j.action,leaseToken:token};
  },
  async complete(id,token){
   if(!Number.isSafeInteger(id)||id<1||!isUuid(token))throw TypeError('Invalid acknowledgment');
   const r=await pool.query('select aurea_private.finish_weekly_delivery_job($1::bigint,$2::uuid,true) as finished',[id,token]);
   return r?.rows?.length===1&&r.rows[0].finished===true;
  },
  async fail(id,token){
   if(!Number.isSafeInteger(id)||id<1||!isUuid(token))throw TypeError('Invalid failure acknowledgment');
   const r=await pool.query('select aurea_private.finish_weekly_delivery_job($1::bigint,$2::uuid,false) as finished',[id,token]);
   return r?.rows?.length===1&&r.rows[0].finished===true;
  }
 };
 async function finishRecipient(job,key,provider,confirmed){
  const [id,token]=scope(job);
  if(!validKey(key))throw TypeError('Invalid delivery key');
  const r=await pool.query('select aurea_private.finish_recipient_delivery($1::bigint,$2::uuid,$3::text,$4::text,$5::boolean) as finished',[id,token,key,provider,confirmed]);
  return r?.rows?.length===1&&r.rows[0].finished===true;
 }
}
function scope(job){
 const id=job?.jobId,token=job?.leaseToken;
 if(!Number.isSafeInteger(id)||id<1||!isUuid(token))throw TypeError('Invalid job lease');
 return [id,token];
}
function fullScope(job){
 const [id,token]=scope(job);
 if(!isUuid(job.organizationId)||!['invite','reminder','report'].includes(job.action)||typeof job.weekStart!=='string')throw TypeError('Invalid delivery scope');
 const d=new Date(job.weekStart+'T12:00:00Z');
 if(!Number.isFinite(+d)||d.toISOString().slice(0,10)!==job.weekStart||d.getUTCDay()!==1)throw TypeError('Invalid delivery week');
 return [id,token,job.organizationId,job.weekStart,job.action];
}
function validKey(key){return typeof key==='string'&&/^[a-f0-9]{64}$/.test(key)}
function isUuid(v){return typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)}
module.exports={createWeeklyDeliveryStore};
