'use strict';
const {createHash}=require('node:crypto');
function createEmployeeRuntimeHttp(handler){
 if(typeof handler!=='function')throw TypeError('Restricted runtime required');
 const reply=(statusCode,status)=>({statusCode,headers:{'content-type':'application/json','cache-control':'no-store','referrer-policy':'no-referrer'},body:JSON.stringify({status})});
 return async ({method,path,body,sourceIp,headers}={})=>{
 if(method!=='POST'||!['/api/employee/invitation','/api/employee/submit'].includes(path))return reply(405,'unavailable');
 if(!/^application\/json(?:\s*;|$)/i.test(headers?.['content-type']||''))return reply(415,'invalid');
 if(typeof sourceIp!=='string'||!sourceIp||typeof body!=='string'||Buffer.byteLength(body)>8192)return reply(400,'invalid');
 let data;try{data=JSON.parse(body)}catch{return reply(400,'invalid')}
 const action=path.endsWith('/submit')?'submit':'invitation';
 if(!data||Array.isArray(data)||typeof data.token!=='string'||!/^[a-f0-9]{64}$/.test(data.token)||Object.keys(data).some(k=>!(action==='submit'?['token','answers']:['token']).includes(k)))return reply(400,'invalid');
 const hash=createHash('sha256').update(data.token,'utf8').digest('hex');
 try{return await handler({httpMethod:'POST',headers:{'content-type':'application/json'},requestContext:{identity:{sourceIp}},body:JSON.stringify({action,hash,...(action==='submit'?{answers:data.answers}:{})})})}catch{return reply(503,'unavailable')}
 };
}
module.exports={createEmployeeRuntimeHttp};
