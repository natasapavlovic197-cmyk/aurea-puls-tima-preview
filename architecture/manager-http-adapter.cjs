'use strict';
function createHttpAdapter({handler}={}){
 if(typeof handler!=='function')throw TypeError('Handler required');
 return async function dispatch({method,url,headers,body,sourceIp}={}){
 const parsed=new URL(url,'https://staging.invalid');
 if(parsed.pathname!=='/api/manager-workspace')return {statusCode:404,headers:{'cache-control':'no-store'},body:'Not found'};
 if(typeof sourceIp!=='string'||!sourceIp)return {statusCode:403,headers:{'cache-control':'no-store'},body:'Unavailable'};
 const ids=parsed.searchParams.getAll('organization_id');
 if(ids.length!==1)return {statusCode:400,headers:{'cache-control':'no-store'},body:'Invalid request'};
 return handler({httpMethod:method,headers,body,queryStringParameters:{organization_id:ids[0]},requestContext:{identity:{sourceIp}},isBase64Encoded:false});
 };
}
module.exports={createHttpAdapter};
