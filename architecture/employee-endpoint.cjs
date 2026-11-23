'use strict';
const {createHash}=require('node:crypto');
function createEmployeeEndpoint({rpc,limit}={}){
 if(typeof rpc!=='function'||typeof limit!=='function')throw TypeError('Restricted RPC and limiter required');
 const reply=(statusCode,status,extra={})=>({statusCode,headers:{'content-type':'application/json','cache-control':'no-store','referrer-policy':'no-referrer'},body:JSON.stringify({status,...extra})});
 return async function handle({method,path,body,sourceIp}={}){
 if(method!=='POST'||!['/api/employee/invitation','/api/employee/submit'].includes(path))return reply(405,'unavailable');
 if(typeof sourceIp!=='string'||!sourceIp)return reply(403,'unavailable');
 try{if(!await limit('employee',sourceIp))return reply(429,'unavailable');}catch{return reply(429,'unavailable');}
 if(typeof body!=='string'||Buffer.byteLength(body)>16000)return reply(400,'invalid');
 try{
 const data=JSON.parse(body);
 if(!data||typeof data.token!=='string'||!/^[a-f0-9]{64}$/.test(data.token))return reply(400,'invalid');
 const hash=createHash('sha256').update(data.token,'utf8').digest('hex');
 if(path.endsWith('/invitation')){
 const result=await rpc('aurea_employee_invitation',{p_hash:hash});
 if(result?.status!=='ready'||!Array.isArray(result.questions)||result.questions.length!==6)return reply(404,'unavailable');
 const questions=result.questions.map(({code,wording,position})=>({code,wording,position}));
 return reply(200,'ready',{questions});
 }
 const a=data.answers;
 if(!Array.isArray(a)||a.length!==6||new Set(a.map(x=>x?.code)).size!==6||a.some(x=>!x||typeof x.code!=='string'||!/^[A-Z_]+$/.test(x.code)||!Number.isInteger(x.rating)||x.rating<1||x.rating>6))return reply(400,'invalid_answers');
 const result=await rpc('aurea_employee_submit',{p_hash:hash,p_answers:a.map(({code,rating})=>({code,rating}))});
 return result?.status==='submitted'?reply(200,'submitted'):reply(409,'unavailable');
 }catch{return reply(503,'unavailable');}
 };
}
module.exports={createEmployeeEndpoint};
