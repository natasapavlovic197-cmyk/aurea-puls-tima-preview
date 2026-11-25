'use strict';
const {requireRole}=require('./policy.cjs');
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(x);
const jwt=x=>typeof x==='string'&&x.length<=16384&&/^[-\w]+\.[-\w]+\.[-\w]+$/.test(x);
function createDeliverySession({auth,identityId,clock=Date.now,role,env}={}){requireRole(role,env);
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
module.exports={createDeliverySession};
