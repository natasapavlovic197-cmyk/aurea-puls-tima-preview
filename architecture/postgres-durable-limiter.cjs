'use strict';
const {createHmac}=require('node:crypto');
// Shared Postgres counter, atomic across all Netlify instances. Table must be
// installed in a private schema and accessible only by a restricted server role.
// No raw IP, token or email is stored: HMAC keys are non-reversible.
const SQL=`insert into aurea_private.api_rate_limits(bucket_key,window_start,hits)
values ($1::text,to_timestamp($2::bigint),1)
on conflict (bucket_key,window_start) do update
set hits=aurea_private.api_rate_limits.hits+1
returning hits`;
function createDurableLimiter({query,secret,maxHits=10,windowSeconds=300,clock=()=>Date.now()}={}){
 if(typeof query!=='function'||typeof secret!=='string'||secret.length<32||!Number.isInteger(maxHits)||maxHits<1||!Number.isInteger(windowSeconds)||windowSeconds<1||typeof clock!=='function')throw new TypeError('Invalid limiter configuration');
 return async function limit({ip,scope}={}){
  if(typeof ip!=='string'||ip.length<3||ip.length>128||typeof scope!=='string'||!/^[a-z-]{1,32}$/.test(scope))return false;
  try{
   const now=clock();
   if(!Number.isFinite(now))return false;
   const windowStart=Math.floor(now/1000/windowSeconds)*windowSeconds;
   const bucket=createHmac('sha256',secret).update(scope+'\0'+ip).digest('hex');
   const result=await query(SQL,[bucket,windowStart]);
   const hits=Number(result?.rows?.[0]?.hits);
   return Number.isSafeInteger(hits)&&hits>=1&&hits<=maxHits;
  }catch{return false}
 };
}
module.exports={createDurableLimiter,SQL};
