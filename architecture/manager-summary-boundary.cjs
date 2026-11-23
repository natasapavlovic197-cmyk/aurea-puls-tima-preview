'use strict';
// Server-only manager summary boundary. No public route is wired to this module.
// Adapter MUST verify authenticated user and membership using trusted DB records,
// not a client-supplied tenant or role claim.
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function createManagerSummaryHandler({authenticate,authorize,readPublishedReport,rateLimit}={}){
 const respond=(statusCode,message,report)=>({statusCode,headers:{'content-type':'application/json','cache-control':'no-store','vary':'Authorization'},body:JSON.stringify(report===undefined?{message}:{report})});
 return async function handler(event){
  if(event?.httpMethod!=='GET')return respond(405,'Method not allowed');
  const organizationId=event.queryStringParameters?.organization_id;
  if(typeof organizationId!=='string'||!UUID.test(organizationId))return respond(400,'Invalid request');
  if(typeof authenticate!=='function'||typeof authorize!=='function'||typeof readPublishedReport!=='function'||typeof rateLimit!=='function')return respond(503,'Service unavailable');
  try{
   const allowed=await rateLimit(event);
   if(allowed!==true)return respond(429,'Please try again later');
   const user=await authenticate(event);
   if(!user?.id)return respond(401,'Authentication required');
   const permitted=await authorize({userId:user.id,organizationId,roles:['manager','tenant_admin']});
   if(permitted!==true)return respond(403,'Access denied');
   // Adapter may return ONLY frozen, privacy-reviewed published aggregates;
   // never raw responses, counts below thresholds, or live partial summaries.
   const publication=await readPublishedReport({organizationId});
   if(!publication)return respond(404,'No published report');
   if(publication.organizationId!==organizationId||publication.immutable!==true||publication.privacyApproved!==true)return respond(503,'Report unavailable');
   const domains=publication.domains;
   if(!domains||typeof domains!=='object'||Array.isArray(domains)||!Object.keys(domains).length)return respond(503,'Report unavailable');
   if(!Object.values(domains).every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=1&&v<=5))return respond(503,'Report unavailable');
   // Strict output allowlist: do not expose employee IDs, tokens, raw counts, timestamps.
   return respond(200,'OK',{week:publication.week,domains});
  }catch{
   return respond(503,'Service unavailable');
  }
 };
}
module.exports={createManagerSummaryHandler};
