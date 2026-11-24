'use strict';
// Server-only Supabase Auth + manager RPC bridge. Does not use service_role.
// Uses the user's JWT for both identity verification and SQL membership authorization.
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function createManagerBridge({url,key,fetchImpl=globalThis.fetch}={}){
 if(typeof url!=='string'||!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)||typeof key!=='string'||!key||typeof fetchImpl!=='function')throw new TypeError('Invalid server configuration');
 const headers=token=>({'apikey':key,'authorization':'Bearer '+token,'content-type':'application/json','cache-control':'no-store'});
 async function authenticate(event){
  const match=/^Bearer ([A-Za-z0-9_.-]+)$/.exec(event?.headers?.authorization||event?.headers?.Authorization||'');
  if(!match)return null;
  const token=match[1];
  const r=await fetchImpl(url+'/auth/v1/user',{headers:headers(token),signal:AbortSignal.timeout(5000)});
  if(!r.ok)return null;
  const user=await r.json();
  return UUID.test(user?.id||'')?{id:user.id,token}:null;
 }
 async function readSummary({token,organizationId}){
  if(!UUID.test(organizationId)||typeof token!=='string')throw new TypeError('Invalid summary request');
  const r=await fetchImpl(url+'/rest/v1/rpc/aurea_manager_summary',{method:'POST',headers:headers(token),body:JSON.stringify({p_organization_id:organizationId}),signal:AbortSignal.timeout(7000)});
  if(!r.ok)throw new Error('Manager summary denied');
  const rows=await r.json();
  if(!Array.isArray(rows))throw new Error('Invalid summary response');
  // These are SQL-authenticated, thresholded, closed-cycle rows.
  return rows.map(row=>{
   const count=row.response_count;
   const percent=row.favorable_percent;
   if(typeof row.week_start!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(row.week_start)||typeof row.domain!=='string'||!row.domain||typeof row.question_code!=='string'||!row.question_code||!Number.isSafeInteger(Number(count))||Number(count)<5||percent===null||percent===undefined||percent===''||!Number.isFinite(Number(percent))||Number(percent)<0||Number(percent)>100)throw new Error('Invalid or non-private report');
   return {week:row.week_start,domain:row.domain,question:row.question_code,favorablePercent:Number(percent)};
  });
 }
 async function readAuthorizedPublications({token,organizationId}){
  if(!UUID.test(organizationId)||typeof token!=='string'||!token)throw new TypeError('Invalid publication request');
  const r=await fetchImpl(url+'/rest/v1/rpc/aurea_manager_publications_v2',{method:'POST',headers:headers(token),body:JSON.stringify({p_organization_id:organizationId}),signal:AbortSignal.timeout(7000)});
  if(!r.ok)throw new Error('Publication denied');
  return require('./publication-row-adapter.cjs').normalizePublications(await r.json());
 }
 async function actionRpc(name,token,organizationId,params={}){
  if(!UUID.test(organizationId)||typeof token!=='string'||!token)throw new TypeError('Invalid activity request');
  const r=await fetchImpl(url+'/rest/v1/rpc/'+name,{method:'POST',headers:headers(token),body:JSON.stringify({...params,p_organization_id:organizationId}),signal:AbortSignal.timeout(7000)});
  if(!r.ok)throw new Error('Activity request denied');
  return r.json();
 }
 async function readActions({token,organizationId}){
  const rows=await actionRpc('aurea_manager_actions',token,organizationId);
  if(!Array.isArray(rows)||rows.length>100||rows.some(a=>!a||!UUID.test(a.id)||typeof a.description!=='string'||!['open','done','in_progress','cancelled'].includes(a.status)))throw new Error('Invalid activities');
  return rows.map(({id,description,due_on,status})=>({id,description,due_on:due_on??null,status}));
 }
 async function saveAction({token,organizationId,description,dueOn=null,cycleId=null,actionId=null,status='open'}){
  if(typeof description!=='string'||description.trim().length<3||description.trim().length>2000||!['open','done'].includes(status)||(actionId!==null&&!UUID.test(actionId))||(cycleId!==null&&!UUID.test(cycleId))||(dueOn!==null&&(typeof dueOn!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(dueOn))))throw new TypeError('Invalid activity');
  const id=await actionRpc('aurea_manager_save_action',token,organizationId,{p_description:description.trim(),p_due_on:dueOn,p_cycle_id:cycleId,p_action_id:actionId,p_status:status});
  if(typeof id!=='string'||!UUID.test(id))throw new Error('Invalid saved activity');
  return id;
 }
 return Object.freeze({authenticate,readSummary,readAuthorizedPublications,readActions,saveAction});
}
module.exports={createManagerBridge};
