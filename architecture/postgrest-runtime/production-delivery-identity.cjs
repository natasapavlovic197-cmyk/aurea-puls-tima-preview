'use strict';
const {verifyPublic,verifyBrowser,assertActive}=require('./production-runtime-gate.cjs');
// Server-only preparation; never import into browser build. No automatic activation.
const BASE='https://dlibifwlmbfkboerlmqd.supabase.co';
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(x);
const jwt=x=>typeof x==='string'&&x.length<=16384&&/^[-\w]+\.[-\w]+\.[-\w]+$/.test(x);
function createDeliverySession({auth,identityId,clock=Date.now}={}){assertActive();
 if(!uuid(identityId)||!auth||['signIn','refresh','getUser','signOut'].some(k=>typeof auth[k]!=='function'))throw Error('Invalid delivery identity configuration');
 let session=null,pending=null,closed=false,closing=null,revocationToken=null;
 async function acquire(){
  if(closed)throw Error('Delivery session closed');
  try{
   const now=clock();
   if(!Number.isFinite(now))throw Error();
   if(session&&session.expiresAt>now+60000)return session.accessToken;
   const next=await (session?auth.refresh(session.refreshToken):auth.signIn());
   // Retain a valid provider-issued bearer for cleanup before getUser or other validation.
   if(jwt(next?.accessToken))revocationToken=next.accessToken;
   if(!next||!jwt(next.accessToken)||typeof next.refreshToken!=='string'||!next.refreshToken||next.refreshToken.length>16384||!Number.isFinite(next.expiresAt)||next.expiresAt<=clock()+60000||next.userId!==identityId)throw Error();
   // Trust provider identity verification, not decoded unsigned JWT claims.
   const user=await auth.getUser(next.accessToken);
   if(user?.id!==identityId)throw Error();
   if(closed)throw Error();
   session={accessToken:next.accessToken,refreshToken:next.refreshToken,expiresAt:next.expiresAt};
   return session.accessToken;
  }catch{session=null;closed=true;throw Error('Delivery authentication failed; session disabled');}
 }
 async function readToken(){
  if(closed)throw Error('Delivery session closed');
  if(!pending)pending=acquire().finally(()=>{pending=null});
  const token=await pending;
  if(closed)throw Error('Delivery authentication failed; session disabled');
  return token;
 }
 function close(){
  closed=true;
  if(!closing)closing=(async()=>{
   if(pending)try{await pending}catch{}
   const token=revocationToken;session=null;
   if(token)try{await auth.signOut(token);revocationToken=null}catch{throw Error('Delivery session revocation unconfirmed');}
  })();
  return closing;
 }
 return Object.freeze({readToken,close});
}
function readServerConfig(env={}){
 if(typeof window!=='undefined')throw Error('Server only');
 if(env.AUREA_DELIVERY_ENABLED==='true'||env.AUREA_DELIVERY_DEPLOY_APPROVED==='true')throw Error('Delivery activation not approved');
 const url=env.AUREA_SUPABASE_URL,key=env.AUREA_SUPABASE_PUBLISHABLE_KEY,identityId=env.AUREA_DELIVERY_AUTH_USER_ID,hmacSecret=env.AUREA_INVITATION_HMAC_SECRET;
 verifyPublic({url,key});if(env.AUREA_ENVIRONMENT!=='production'||String(identityId).toLowerCase()==='3070286d-a61b-43f2-8d2b-d3c0461bf54c')throw Error('Invalid production identity');assertActive();
 if(url!==BASE||typeof key!=='string'||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)||!uuid(identityId))throw Error('Invalid production delivery configuration');
 if(typeof hmacSecret!=='string'||!/^[a-f0-9]{64}$/.test(hmacSecret)||/^([a-f0-9])\1{63}$/.test(hmacSecret)||hmacSecret===env.AUREA_LIMITER_SECRET)throw Error('Invalid independent invitation secret');
 return {url,key,identityId,hmacSecret};
}
// Auth adapter is injected; live credential storage/identity provisioning remains a separate gate.
// No public issue/schedule entrypoint: this factory only prepares a disabled pipeline.
function prepareDeliveryIdentity({env,auth,clock=Date.now,origin,fetchImpl=globalThis.fetch}={}){
 const c=readServerConfig(env);
 const session=createDeliverySession({auth,identityId:c.identityId,clock});
 const {prepareHttpsDelivery}=require('./production-delivery-service.cjs');
 const delivery=prepareHttpsDelivery({url:c.url,key:c.key,readToken:session.readToken,hmacSecret:c.hmacSecret,origin,fetchImpl,clock:()=>new Date(clock()),enabled:false});
 return Object.freeze({processNext:delivery.processNext,close:session.close});
}
module.exports={createDeliverySession,readServerConfig,prepareDeliveryIdentity};
