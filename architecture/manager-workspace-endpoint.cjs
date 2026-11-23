'use strict';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const response=(statusCode,body)=>({statusCode,headers:{'content-type':'application/json','cache-control':'no-store','referrer-policy':'no-referrer'},body:JSON.stringify(body)});
function createManagerWorkspaceEndpoint({service,limit}={}){
 if(typeof service?.overview!=='function'||typeof service?.save!=='function'||typeof limit!=='function')throw new TypeError('Missing trusted dependencies');
 return async event=>{
  const method=event?.httpMethod;
  if(!['GET','POST'].includes(method))return response(405,{status:'method_not_allowed'});
  const org=event?.queryStringParameters?.organization_id;
  if(typeof org!=='string'||!UUID.test(org))return response(400,{status:'invalid'});
  const ip=event?.requestContext?.identity?.sourceIp;
  if(typeof ip!=='string'||!ip)return response(503,{status:'unavailable'});
  try{
   if(await limit({ip,scope:'manager-workspace'})!==true)return response(429,{status:'try_later'});
   if(method==='GET')return response(200,{status:'ready',...await service.overview(event,org)});
   if(event.isBase64Encoded||typeof event.body!=='string'||event.body.length>16000)return response(400,{status:'invalid'});
   let input;try{input=JSON.parse(event.body)}catch{return response(400,{status:'invalid'});}
   if(!input||typeof input!=='object'||Array.isArray(input))return response(400,{status:'invalid'});
   return response(200,{status:'saved',...await service.save(event,org,input)});
  }catch{return response(403,{status:'unavailable'});}
 };
}
module.exports={createManagerWorkspaceEndpoint};
