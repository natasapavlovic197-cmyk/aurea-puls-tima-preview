'use strict';
const {verifyPublic}=require('../postgrest-runtime/production-runtime-gate.cjs');
const {requireRole}=require('./policy.cjs');
// Server-only first-party Supabase Auth adapter. No signup, OTP, admin or email APIs.
const BASE='https://dlibifwlmbfkboerlmqd.supabase.co';
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(x);
const jwt=x=>typeof x==='string'&&x.length<=16384&&/^[-\w]+\.[-\w]+\.[-\w]+$/.test(x);
const opaque=x=>typeof x==='string'&&x.length>0&&x.length<=16384&&!/[\s\x00-\x1f\x7f]/.test(x);
function createSupabaseDeliveryAuth({url,key,identityId,readCredentials,fetchImpl=globalThis.fetch,clock=Date.now,role,env}={}){
 verifyPublic({url,key});requireRole(role,env);
 if(typeof window!=='undefined'||url!==BASE||typeof key!=='string'||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)||!uuid(identityId)||typeof readCredentials!=='function'||typeof fetchImpl!=='function'||typeof clock!=='function')throw Error('Invalid server Auth configuration');
 async function request(path,{method='POST',body,token,empty=false}={}){
  try{
   const headers={apikey:key,'content-type':'application/json','cache-control':'no-store'};
   if(token!==undefined){if(!jwt(token))throw Error();headers.authorization='Bearer '+token;}
   const r=await fetchImpl(BASE+'/auth/v1/'+path,{method,headers,...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'error',cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(10000)});
   if(!r.ok)throw Error();
   if(empty){if(![200,204].includes(r.status))throw Error();return;}
   if(r.status!==200)throw Error();
   return await r.json();
  }catch{throw Error('Delivery Auth request failed');}
 }
 function normalize(data,started){
  const expiresAt=started+Number(data?.expires_in)*1000;
  if(!jwt(data?.access_token)||!opaque(data?.refresh_token)||data?.user?.id!==identityId||data.user.is_anonymous===true||String(data.token_type).toLowerCase()!=='bearer'||!Number.isSafeInteger(data.expires_in)||data.expires_in<=60||data.expires_in>86400||!Number.isFinite(expiresAt)||expiresAt<=clock()+60000)throw Error('Invalid delivery Auth response');
  return {accessToken:data.access_token,refreshToken:data.refresh_token,expiresAt,userId:identityId};
 }
 async function signIn(){
  try{
   const c=await readCredentials();
   if(typeof c?.email!=='string'||c.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)||typeof c.password!=='string'||c.password.length<16||c.password.length>1024)throw Error();
   const started=clock();
   return normalize(await request('token?grant_type=password',{body:{email:c.email,password:c.password}}),started);
  }catch{throw Error('Delivery Auth sign-in failed');}
 }
 async function refresh(refreshToken){
  if(!opaque(refreshToken))throw Error('Invalid delivery refresh token');
  const started=clock();
  return normalize(await request('token?grant_type=refresh_token',{body:{refresh_token:refreshToken}}),started);
 }
 async function getUser(token){
  const u=await request('user',{method:'GET',token});
  if(u?.id!==identityId||u.is_anonymous===true)throw Error('Delivery Auth identity mismatch');
  return {id:identityId};
 }
 async function signOut(token){await request('logout?scope=local',{token,empty:true});}
 return Object.freeze({signIn,refresh,getUser,signOut});
}
module.exports={createSupabaseDeliveryAuth};
