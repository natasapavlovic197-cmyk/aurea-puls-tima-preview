'use strict';
const {buildPublishedManagerReport}=require('./published-manager-report.cjs');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const response=(statusCode,body)=>({statusCode,headers:{'content-type':'application/json','cache-control':'no-store','referrer-policy':'no-referrer'},body:JSON.stringify(body)});
// Requires a trusted repository which enforces organization membership using the verified user token.
function createPublishedReportEndpoint({authenticate,readAuthorizedPublications,limit}={}){
 if([authenticate,readAuthorizedPublications,limit].some(f=>typeof f!=='function'))throw TypeError('Missing trusted dependencies');
 return async event=>{
 if(event?.httpMethod!=='GET')return response(405,{status:'method_not_allowed'});
 const org=event?.queryStringParameters?.organization_id;
 if(typeof org!=='string'||!UUID.test(org))return response(400,{status:'invalid'});
 try{
 const ip=event?.requestContext?.identity?.sourceIp;
 if(typeof ip!=='string'||!ip)return response(503,{status:'unavailable'});
 if(await limit({ip,scope:'published-manager-report'})!==true)return response(429,{status:'try_later'});
 const user=await authenticate(event);
 if(!user?.id||!user?.token)return response(401,{status:'unauthorized'});
 const rows=await readAuthorizedPublications({token:user.token,organizationId:org});
 return response(200,{status:'ready',...buildPublishedManagerReport(rows)});
 }catch{return response(403,{status:'unavailable'});}
 };
}
module.exports={createPublishedReportEndpoint};
