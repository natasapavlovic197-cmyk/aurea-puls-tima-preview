'use strict';
// Production-independent manager endpoint factory. Runtime must inject
// durable limiter and verified Supabase JWT bridge. No bypass path.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const response=(statusCode,body)=>({statusCode,headers:{'content-type':'application/json','cache-control':'no-store','referrer-policy':'no-referrer'},body:JSON.stringify(body)});
function createManagerEndpoint({bridge,limit}={}){
 if(typeof bridge?.authenticate!=='function'||typeof bridge?.readSummary!=='function'||typeof limit!=='function')throw new TypeError('Missing trusted runtime dependencies');
 return async function handle(event){
  if(event?.httpMethod!=='GET')return response(405,{status:'method_not_allowed'});
  const org=event?.queryStringParameters?.organization_id;
  if(typeof org!=='string'||!UUID.test(org))return response(400,{status:'invalid'});
  try{
   // Fail closed: IP is only accepted from a trusted server-provided property.
   const ip=event?.requestContext?.identity?.sourceIp;
   if(typeof ip!=='string'||!ip)return response(503,{status:'unavailable'});
   if(await limit({ip,scope:'manager-summary'})!==true)return response(429,{status:'try_later'});
   const user=await bridge.authenticate(event);
   if(!user?.id||!user?.token)return response(401,{status:'unauthorized'});
   const rows=await bridge.readSummary({token:user.token,organizationId:org});
   if(!Array.isArray(rows)||rows.length>200||!rows.every(x=>x&&typeof x.week==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x.week)&&typeof x.domain==='string'&&x.domain.length>0&&x.domain.length<=80&&typeof x.question==='string'&&x.question.length>0&&x.question.length<=80&&Number.isFinite(x.favorablePercent)&&x.favorablePercent>=0&&x.favorablePercent<=100))return response(503,{status:'unavailable'});
   // Duplicate domain/question/week rows indicate a malformed publication.
   // Reject rather than displaying a misleading manager report.
   const keys=rows.map(x=>JSON.stringify([x.week,x.domain,x.question]));
   if(new Set(keys).size!==keys.length)return response(503,{status:'unavailable'});
   return response(200,{status:'ready',report:rows.map(({week,domain,question,favorablePercent})=>({week,domain,question,favorablePercent}))});
  }catch{return response(403,{status:'unavailable'})}
 };
}
module.exports={createManagerEndpoint};
