'use strict';
// Fail-closed, server-only submission boundary. Not wired to live credentials or public UI.
// Inject a verified server adapter with an atomic submitPulse(token, answers) implementation.
const TOKEN=/^[a-f0-9]{64}$/i, UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function validatePulse(body){
  if(!body||typeof body!=='object'||Array.isArray(body))return false;
  if(typeof body.token!=='string'||!TOKEN.test(body.token))return false;
  if(!Array.isArray(body.answers)||body.answers.length!==4)return false;
  const seen=new Set();
  for(const a of body.answers){
    if(!a||typeof a!=='object'||Array.isArray(a)||typeof a.question_id!=='string'||!UUID.test(a.question_id)||!Number.isInteger(a.rating)||a.rating<1||a.rating>5||seen.has(a.question_id.toLowerCase()))return false;
    seen.add(a.question_id.toLowerCase());
  }
  return true;
}
function createPulseSubmitHandler({adapter,rateLimit}={}){
  return async function handler(event){
    const headers={'content-type':'application/json','cache-control':'no-store'};
    const reply=(statusCode,message)=>({statusCode,headers,body:JSON.stringify({message})});
    if(event.httpMethod!=='POST')return reply(405,'Method not allowed');
    if(!event.headers||!/^application\/json(?:\s*;|$)/i.test(event.headers['content-type']||event.headers['Content-Type']||''))return reply(415,'Unsupported content type');
    if(typeof event.body!=='string'||Buffer.byteLength(event.body,'utf8')>8192)return reply(400,'Invalid request');
    let body;try{body=JSON.parse(event.body)}catch{return reply(400,'Invalid request')}
    if(!validatePulse(body))return reply(400,'Invalid request');
    // No adapter / no rate limiter: closed. Never allow a token to bypass throttling.
    if(typeof adapter?.submitPulse!=='function'||typeof rateLimit!=='function')return reply(503,'Service unavailable');
    try{
      // Rate limiter must be durable/shared across instances; reject on errors.
      const allowed=await rateLimit(event);
      if(allowed!==true)return reply(429,'Please try again later');
      await adapter.submitPulse(body.token,body.answers);
      return reply(200,'Response received');
    }catch{
      // No raw token, answer values, email, or detailed DB error in client response or logs.
      return reply(400,'Unable to submit response');
    }
  };
}
module.exports={validatePulse,createPulseSubmitHandler};
