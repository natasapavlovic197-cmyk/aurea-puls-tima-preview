'use strict';
// Server-only boundary for the EXISTING public.aurea_employee_* hash/code protocol.
// Not a deployed function: dependencies must be injected by a trusted server runtime.
// Never log hashes, answers, IPs or SQL details.
const HASH=/^[a-f0-9]{64}$/, CODE=/^[A-Z_]{1,32}$/;
const reply=(statusCode,status)=>({statusCode,headers:{'content-type':'application/json','cache-control':'no-store','referrer-policy':'no-referrer'},body:JSON.stringify({status})});
function validAnswers(a){
 if(!Array.isArray(a)||a.length!==6)return false;
 const seen=new Set();
 for(const item of a){
  if(!item||typeof item!=='object'||Array.isArray(item)||Object.keys(item).some(k=>!['code','rating'].includes(k))||typeof item.code!=='string'||!CODE.test(item.code)||seen.has(item.code)||!Number.isInteger(item.rating)||item.rating<1||item.rating>6)return false;
  seen.add(item.code);
 }
 return true;
}
function createEmployeeGateway({adapter,rateLimit}={}){
 return async function handler(event){
  if(event?.httpMethod!=='POST')return reply(405,'method_not_allowed');
  if(!/^application\/json(?:\s*;|$)/i.test(event.headers?.['content-type']||event.headers?.['Content-Type']||''))return reply(415,'unsupported_content_type');
  if(event.isBase64Encoded||typeof event.body!=='string'||Buffer.byteLength(event.body,'utf8')>8192)return reply(400,'invalid');
  let body;try{body=JSON.parse(event.body)}catch{return reply(400,'invalid')}
  if(!body||typeof body!=='object'||Array.isArray(body)||typeof body.hash!=='string'||!HASH.test(body.hash))return reply(400,'invalid');
  // Strict request schema: reject extra personal fields instead of silently accepting them.
  const allowed=body.action==='submit'?['action','hash','answers']:['action','hash'];
  if(Object.keys(body).some(k=>!allowed.includes(k)))return reply(400,'invalid');
  if(!['invitation','submit'].includes(body.action))return reply(400,'invalid');
  if(body.action==='submit'&&!validAnswers(body.answers))return reply(400,'invalid');
  if(body.action==='invitation'&&Object.hasOwn(body,'answers'))return reply(400,'invalid');
  if(typeof rateLimit!=='function'||typeof adapter?.invitation!=='function'||typeof adapter?.submit!=='function')return reply(503,'unavailable');
  try{
   // Durable, shared rate limit MUST be configured before deployment. Fail closed.
   if(await rateLimit(event,body.action)!==true)return reply(429,'try_later');
   const result=body.action==='invitation'?await adapter.invitation(body.hash):await adapter.submit(body.hash,body.answers.map(({code,rating})=>({code,rating})));
   if(body.action==='submit')return reply(result?.status==='submitted'?200:400,result?.status==='submitted'?'submitted':'unavailable');
   if(result?.status!=='ready')return reply(404,'unavailable');
   const q=result.questions;
   if(!Array.isArray(q)||q.length!==6||!q.every(x=>x&&typeof x.code==='string'&&CODE.test(x.code)&&typeof x.wording==='string'&&x.wording.length>0&&Number.isInteger(x.position)&&x.position>=1&&x.position<=6))return reply(503,'unavailable');
   const positions=new Set(q.map(x=>x.position)),codes=new Set(q.map(x=>x.code));
   if(positions.size!==6||codes.size!==6)return reply(503,'unavailable');
   const safe=q.map(({code,wording,position})=>({code,wording,position}));
   return {statusCode:200,headers:{'content-type':'application/json','cache-control':'no-store','referrer-policy':'no-referrer'},body:JSON.stringify({status:'ready',questions:safe})};
  }catch{return reply(503,'unavailable')}
 };
}
module.exports={createEmployeeGateway,validAnswers};
