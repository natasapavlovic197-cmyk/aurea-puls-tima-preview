'use strict';
const {belgradeParts}=require('../weekly-orchestrator.cjs');
const {createDeliveryHttpsPool}=require('./delivery-https-pool.cjs');
const {createWeeklyDeliveryStore}=require('../weekly-delivery-store.cjs');
// Invoked by a future server-side timer. Queue only; never claims or sends.
async function scheduleWeekly({url,key,readToken,enabled=false,clock=()=>new Date(),fetchImpl=globalThis.fetch}={}){
 if(!enabled)return {status:'disabled'};
 if(url!=='https://ublzmoroanhlcgpnxilw.supabase.co'||!key?.startsWith('sb_publishable_')||typeof readToken!=='function')throw Error('Staging configuration required');
 const p=belgradeParts(clock());
 if(!['monday','wednesday','friday'].includes(p.day)||p.hour<9)return {status:'outside_schedule'};
 const token=await readToken();
 if(typeof token!=='string'||!/^[-\w]+\.[-\w]+\.[-\w]+$/.test(token))throw Error('Dedicated session required');
 const response=await fetchImpl(url+'/rest/v1/rpc/aurea_delivery_schedule_due',{method:'POST',headers:{apikey:key,authorization:'Bearer '+token,'content-type':'application/json'},body:'{}',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Schedule denied: '+response.status);
 const rows=await response.json();
 if(!Array.isArray(rows)||rows.length>1)throw Error('Invalid schedule response');
 if(!rows.length)return {status:'outside_schedule'};
 const {action,queued,not_ready}=rows[0];
 if(!['invite','reminder','report'].includes(action)||!Number.isSafeInteger(queued)||queued<0||!Number.isSafeInteger(not_ready)||not_ready<0)throw Error('Invalid schedule result');
 return {status:'queued',action,queued,notReady:not_ready};
}
// The same durable queue is consumed by the verified HTTPS store; not invoked by scheduler.
function createScheduledDeliveryStore(config){return createWeeklyDeliveryStore({pool:createDeliveryHttpsPool(config),resolveInvitationToken:config.resolveInvitationToken});}
module.exports={scheduleWeekly,createScheduledDeliveryStore};
