'use strict';
const {createInvitationIssuer,createInvitationTokenSource}=require('../staging-delivery-service.cjs');
const {belgradeParts}=require('../weekly-orchestrator.cjs');
const {createDeliveryHttpsPool}=require('./delivery-https-pool.cjs');
const {createWeeklyDeliveryStore}=require('../weekly-delivery-store.cjs');
// Invoked by a future server-side timer. Queue only; never claims or sends.
async function scheduleWeekly({url,key,readToken,enabled=false,hmacSecret,clock=()=>new Date(),fetchImpl=globalThis.fetch}={}){
 if(!enabled)return {status:'disabled'};
 if(url!=='https://ublzmoroanhlcgpnxilw.supabase.co'||!key?.startsWith('sb_publishable_')||typeof readToken!=='function')throw Error('Staging configuration required');
 const p=belgradeParts(clock());
 if(!['monday','wednesday','friday'].includes(p.day)||p.hour<9)return {status:'outside_schedule'};
 const token=await readToken();
 if(typeof token!=='string'||!/^[-\w]+\.[-\w]+\.[-\w]+$/.test(token))throw Error('Dedicated session required');
 if(p.day==='monday'){
 const prep=await fetchImpl(url+'/rest/v1/rpc/aurea_delivery_prepare_current',{method:'POST',headers:{apikey:key,authorization:'Bearer '+token,'content-type':'application/json'},body:'{}',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!prep.ok)throw Error('Cycle preparation denied: '+prep.status);
 const rows=await prep.json();
 if(!Array.isArray(rows))throw Error('Invalid preparation');
 const issue=createInvitationIssuer({pool:createDeliveryHttpsPool({url,key,readToken,fetchImpl}),tokens:createInvitationTokenSource(hmacSecret)});
 for(const row of rows){const result=await issue({organizationId:row.organization_id,weekStart:row.week_start,invitationId:row.invitation_id,email:row.email,expiresAt:new Date(row.expires_at).toISOString()});if(!['created','existing'].includes(result.state))throw Error('Invitation preparation incomplete');}
 }
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
