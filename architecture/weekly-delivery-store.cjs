'use strict';
const {randomUUID}=require('node:crypto');
// This adapter requires a dedicated database login with narrowly scoped EXECUTE
// permissions on the two private SQL functions. Never use an employee or manager pool.
function createWeeklyDeliveryStore({pool}={}){
 if(typeof pool?.query!=='function')throw new TypeError('Dedicated PostgreSQL pool required');
 return {
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
}
function isUuid(v){return typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)}
module.exports={createWeeklyDeliveryStore};
