'use strict';
const {requireRole,ORIGIN,ROUTES}=require('./policy.cjs');
// The worker handles uncertain receipts. Never retry a provider call here.
function createResendProvider({env={},fetchImpl=globalThis.fetch}={}){
 requireRole('delivery',env);
 const key=env.AUREA_RESEND_API_KEY,from=env.AUREA_RESEND_FROM;
 if(typeof key!=='string'||!/^re_[A-Za-z0-9_-]{10,}$/.test(key)||typeof from!=='string'||!(/^[A-Za-z0-9._+-]+@mail\.aureapsihoterapija\.com$/.test(from)))throw Error('Invalid sender configuration');
 return Object.freeze({async send(message){
  requireRole('delivery',env);
  const {to,subject,text,idempotencyKey}=message||{};
  if(typeof to!=='string'||to.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)||typeof subject!=='string'||subject.length>160||/[\r\n]/.test(subject)||typeof text!=='string'||text.length>12000||!/^[a-f0-9]{64}$/.test(idempotencyKey||''))throw Error('Invalid delivery message');
  if(text.includes(ORIGIN+'/employee#')||text.includes('http://')||!text.includes(ORIGIN+ROUTES.manager)&&!text.includes(ORIGIN+ROUTES.employee+'#'))throw Error('Invalid production link');
  try{
   const r=await fetchImpl('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':idempotencyKey},body:JSON.stringify({from,to:[to],subject,text}),redirect:'error',signal:AbortSignal.timeout(8000),cache:'no-store'});
   if(!r.ok)throw Error();
   const d=await r.json();
   if(typeof d?.id!=='string'||!d.id||d.id.length>512)throw Error();
   return {accepted:true,id:d.id};
  }catch{throw Error('Provider outcome unconfirmed; reconcile receipt before retry');}
 }});
}
module.exports={createResendProvider};
