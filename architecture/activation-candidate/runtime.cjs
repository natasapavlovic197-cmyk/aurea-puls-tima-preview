'use strict';
const {API,ORIGIN,policy,requireRole}=require('./policy.cjs');
const {verifyPublic}=require('../postgrest-runtime/production-runtime-gate.cjs');
const {createDeliverySession}=require('./session.cjs');
const {createSupabaseDeliveryAuth}=require('./auth.cjs');
const {createDeliveryHttpsPool}=require('./https-pool.cjs');
const {createInvitationTokenSource,createInvitationIssuer}=require('../staging-delivery-service.cjs');
const {createWeeklyDeliveryStore}=require('../weekly-delivery-store.cjs');
const {createWeeklyDeliveryWorker}=require('../weekly-delivery-worker.cjs');
const {createRecipientSender}=require('./recipient-sender.cjs');
const {createResendProvider}=require('./resend-provider.cjs');
const {belgradeParts}=require('../weekly-orchestrator.cjs');
function configure(kind,env){
 requireRole(kind,env);if(!['scheduler','delivery'].includes(kind))throw Error('Invalid role');
 const url=env.AUREA_SUPABASE_URL,key=env.AUREA_SUPABASE_PUBLISHABLE_KEY;
 verifyPublic({url,key});
 const prefix=kind==='scheduler'?'AUREA_SCHEDULER_AUTH_':'AUREA_WORKER_AUTH_';
 const identityId=env[prefix+'USER_ID'],email=env[prefix+'EMAIL'],password=env[prefix+'PASSWORD'],hmac=env.AUREA_INVITATION_HMAC_SECRET;
 if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(identityId||'')||identityId==='3070286d-a61b-43f2-8d2b-d3c0461bf54c'||identityId===env[kind==='scheduler'?'AUREA_WORKER_AUTH_USER_ID':'AUREA_SCHEDULER_AUTH_USER_ID']||!(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email||''))||email==='aurea-delivery-staging@example.invalid'||typeof password!=='string'||password.length<20||password.length>1024||!(/^[a-f0-9]{64}$/.test(hmac||''))||/^([a-f0-9])\1{63}$/.test(hmac)||hmac===env.AUREA_BACKGROUND_HMAC_SECRET)throw Error('Invalid server-only identity configuration');
 return {url,key,identityId,email,password,hmac};
}
function budgetFetch(fetchImpl,deadline,now=Date.now){
 return (url,opts={})=>{const remain=deadline-now();if(remain<1000)throw Error('Execution budget exhausted');const timer=AbortSignal.timeout(Math.min(8000,remain));return fetchImpl(url,{...opts,signal:opts.signal?AbortSignal.any([opts.signal,timer]):timer});};
}
async function execute(kind,{env=process.env,fetchImpl=globalThis.fetch,clock=Date.now}={}){
 if(!['scheduler','delivery'].includes(kind))throw Error('Invalid role');
 if(!policy(env)[kind])return {status:'disabled'};
 const when=belgradeParts(new Date(clock()));
 if(kind==='scheduler'&&(!['monday','wednesday','friday'].includes(when.day)||when.hour<9))return {status:'outside_schedule'};
 const c=configure(kind,env),deadline=clock()+210000,fetchBudget=budgetFetch(fetchImpl,deadline,clock);
 const readCredentials=async()=>({email:c.email,password:c.password});
 // Auth calls use their existing bounded 10s deadline, including cleanup after work budget.
 const auth=createSupabaseDeliveryAuth({...c,role:kind,env,readCredentials,fetchImpl,clock});
 const session=createDeliverySession({auth,identityId:c.identityId,clock,role:kind,env});
 try{
  const pool=createDeliveryHttpsPool({...c,readToken:session.readToken,fetchImpl:fetchBudget,role:kind,env});
  const tokens=createInvitationTokenSource(c.hmac);
  if(kind==='scheduler'){
   const bearer=await session.readToken();
   const rpc=async(name)=>{const r=await fetchBudget(API+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:c.key,authorization:'Bearer '+bearer,'content-type':'application/json'},body:'{}',redirect:'error',cache:'no-store'});if(!r.ok)throw Error('Schedule request denied');const rows=await r.json();if(!Array.isArray(rows))throw Error('Invalid schedule result');return rows;};
   if(when.day==='monday'){
    const rows=await rpc('aurea_delivery_prepare_current');
    if(rows.length>20||new Set(rows.map(r=>r.organization_id)).size>1)throw Error('Pilot capacity exceeded');
    const issue=createInvitationIssuer({pool,tokens});
    for(const r of rows){if(clock()>deadline-20000)throw Error('Schedule budget exhausted');const result=await issue({organizationId:r.organization_id,weekStart:r.week_start,invitationId:r.invitation_id,email:r.email,expiresAt:new Date(r.expires_at).toISOString()});if(!['created','existing'].includes(result.state))throw Error('Invitation not ready');}
   }
   const rows=await rpc('aurea_delivery_schedule_due');
   if(rows.length!==1||!['invite','reminder','report'].includes(rows[0].action)||!Number.isSafeInteger(rows[0].queued)||rows[0].queued<0||!Number.isSafeInteger(rows[0].not_ready)||rows[0].not_ready<0)throw Error('Invalid scheduler response');
   return {status:'queued',action:rows[0].action,queued:rows[0].queued,notReady:rows[0].not_ready};
  }
  const store=createWeeklyDeliveryStore({pool,resolveInvitationToken:tokens.resolveInvitationToken});
  const provider=createResendProvider({env,fetchImpl:fetchBudget});
  const sender=createRecipientSender({store,provider,origin:ORIGIN,enabled:true,clock:()=>new Date(clock()),canContinue:()=>clock()<deadline-20000,maxRecipients:21});
  const processNext=createWeeklyDeliveryWorker({store,sender,enabled:true,clock:()=>new Date(clock())});
  return await processNext();
 }finally{await session.close();}
}
module.exports={execute,configure,budgetFetch};
