'use strict';
// Server-only preparation; never import into browser build. No automatic activation.
const {createInvitationTokenSource}=require('../staging-delivery-service.cjs');
const {prepareHttpsDelivery}=require('./delivery-service.cjs');
const BASE='https://ublzmoroanhlcgpnxilw.supabase.co';
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(x);
const jwt=x=>typeof x==='string'&&x.length<=16384&&/^[-\w]+\.[-\w]+\.[-\w]+$/.test(x);
function createDeliverySession({auth,identityId,clock=Date.now}={}){
 if(!uuid(identityId)||!auth||['signIn','refresh','getUser','signOut'].some(k=>typeof auth[k]!=='function'))throw Error('Invalid delivery identity configuration');
 let session=null,pending=null,closed=false;
 async function acquire(){
  if(closed)throw Error('Delivery session closed');
  try{
   const now=clock();
   if(!Number.isFinite(now))throw Error();
   if(session&&session.expiresAt>now+60000)return session.accessToken;
   const next=await (session?auth.refresh(session.refreshToken):auth.signIn());
   if(!next||!jwt(next.accessToken)||typeof next.refreshToken!=='string'||!next.refreshToken||next.refreshToken.length>16384||!Number.isFinite(next.expiresAt)||next.expiresAt<=clock()+60000||next.userId!==identityId)throw Error();
   // Trust provider identity verification, not decoded unsigned JWT claims.
   const user=await auth.getUser(next.accessToken);
   if(user?.id!==identityId||closed)throw Error();
   session={accessToken:next.accessToken,refreshToken:next.refreshToken,expiresAt:next.expiresAt};
   return session.accessToken;
  }catch{session=null;closed=true;throw Error('Delivery authentication failed; session disabled');}
 }
 async function readToken(){
  if(closed)throw Error('Delivery session closed');
  if(!pending)pending=acquire().finally(()=>{pending=null});
  return pending;
 }
 async function close(){
  closed=true;
  if(pending)try{await pending}catch{}
  const token=session?.accessToken;session=null;
  if(token)try{await auth.signOut(token)}catch{throw Error('Delivery session revocation unconfirmed');}
 }
 return Object.freeze({readToken,close});
}
function readServerConfig(env={}){
 if(typeof window!=='undefined')throw Error('Server only');
 if(env.AUREA_DELIVERY_ENABLED==='true'||env.AUREA_DELIVERY_DEPLOY_APPROVED==='true')throw Error('Delivery activation not approved');
 const url=env.AUREA_SUPABASE_URL,key=env.AUREA_SUPABASE_PUBLISHABLE_KEY,identityId=env.AUREA_DELIVERY_AUTH_USER_ID,hmacSecret=env.AUREA_INVITATION_HMAC_SECRET;
 if(url!==BASE||typeof key!=='string'||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)||!uuid(identityId))throw Error('Invalid staging delivery configuration');
 if(typeof hmacSecret!=='string'||!/^[a-f0-9]{64}$/.test(hmacSecret)||/^([a-f0-9])\1{63}$/.test(hmacSecret)||hmacSecret===env.AUREA_LIMITER_SECRET)throw Error('Invalid independent invitation secret');
 return {url,key,identityId,hmacSecret};
}
// Auth adapter is injected; live credential storage/identity provisioning remains a separate gate.
// No public issue/schedule entrypoint: this factory only prepares a disabled pipeline.
function prepareDeliveryIdentity({env,auth,clock=Date.now,origin}={}){
 const c=readServerConfig(env);
 const session=createDeliverySession({auth,identityId:c.identityId,clock});
 const delivery=prepareHttpsDelivery({url:c.url,key:c.key,readToken:session.readToken,hmacSecret:c.hmacSecret,origin,clock:()=>new Date(clock()),enabled:false});
 return Object.freeze({processNext:delivery.processNext,close:session.close});
}
module.exports={createDeliverySession,readServerConfig,prepareDeliveryIdentity};
