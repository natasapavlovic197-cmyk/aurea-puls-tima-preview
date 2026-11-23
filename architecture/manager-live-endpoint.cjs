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
   if(!Array.isArray(rows)||!rows.every(x=>typeof x.week==='string'&&typeof x.domain==='string'&&typeof x.question==='string'&&Number.isFinite(x.favorablePercent)&&x.favorablePercent>=0&&x.favorablePercent<=100))return response(503,{status:'unavailable'});
   return response(200,{status:'ready',report:rows.map(({week,domain,question,favorablePercent})=>({week,domain,question,favorablePercent}))});
  }catch{return response(403,{status:'unavailable'})}
 };
}
module.exports={createManagerEndpoint};
