'use strict';
const {createHmac,timingSafeEqual}=require('node:crypto');
const {ORIGIN,policy}=require('./policy.cjs');
function sign(kind,stamp,secret){if(!['scheduler','delivery'].includes(kind)||!/^\d{13}$/.test(stamp)||!(/^[a-f0-9]{64}$/.test(secret||''))||/^([a-f0-9])\1{63}$/.test(secret))throw Error('Invalid invocation');return createHmac('sha256',Buffer.from(secret,'hex')).update('aurea-background-v1:'+kind+':'+stamp).digest('hex');}
function verify(kind,stamp,signature,env,now=Date.now()){
 try{if(!policy(env)[kind]||!(/^[a-f0-9]{64}$/.test(signature||''))||Math.abs(now-Number(stamp))>60000)return false;return timingSafeEqual(Buffer.from(signature,'hex'),Buffer.from(sign(kind,stamp,env.AUREA_BACKGROUND_HMAC_SECRET),'hex'));}catch{return false;}
}
async function trigger(kind,env,fetchImpl=globalThis.fetch,clock=Date.now){
 if(!policy(env)[kind])return {status:'disabled'};
 const stamp=String(clock()),signature=sign(kind,stamp,env.AUREA_BACKGROUND_HMAC_SECRET);
 const r=await fetchImpl(ORIGIN+'/.netlify/functions/aurea-job-background',{method:'POST',headers:{'content-type':'application/json','x-aurea-kind':kind,'x-aurea-stamp':stamp,'x-aurea-signature':signature},body:'{}',redirect:'error',signal:AbortSignal.timeout(5000)});
 if(r.status!==202)throw Error('Background acceptance unconfirmed');return {status:'accepted_not_completed'};
}
module.exports={sign,verify,trigger};
