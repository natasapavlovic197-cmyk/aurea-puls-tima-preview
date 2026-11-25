'use strict';
const {API,policy}=require('./policy.cjs');
const roles=Object.freeze({list:'adminRead',billing_list:'adminRead',register:'adminWrite',change:'adminWrite',billing_issue:'billingWrite',billing_confirm_bank:'billingWrite'});
function createHandler({env={},fetchImpl=globalThis.fetch}={}){
 return async req=>{
  const p=policy(env),origin=env.AUREA_ADMIN_ALLOWED_ORIGIN;
  const allowed=typeof origin==='string'&&/^https:\/\/[a-z0-9.-]+$/.test(origin)&&origin!=='https://puls.aureapsihoterapija.com';
  const headers={'Cache-Control':'no-store','Content-Type':'application/json','X-Content-Type-Options':'nosniff','Vary':'Origin'};
  if(allowed&&req.headers.get('origin')===origin)Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'});
  const reply=(code,body)=>new Response(body===null?null:JSON.stringify(body),{status:code,headers});
  if(!p.adminRead&&!p.adminWrite&&!p.billingWrite)return reply(503,{error:'disabled'});
  if(!allowed||req.headers.get('origin')!==origin)return reply(403,{error:'denied'});
  if(req.method==='OPTIONS')return reply(204,null);
  if(req.method!=='POST')return reply(405,{error:'method'});
  const token=req.headers.get('authorization')||'',key=env.AUREA_SUPABASE_PUBLISHABLE_KEY;
  if(!/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)||token.length>16384||key!=='sb_publishable_XFEcctH-xzU6X6ABeIu7mw_IUWVmUhD'||req.headers.get('apikey')!==key)return reply(401,{error:'denied'});
  if(req.headers.get('content-type')?.split(';')[0]!=='application/json')return reply(415,{error:'type'});
  try{
   const reader=req.body?.getReader();if(!reader)return reply(400,{error:'body'});
   let size=0,body='';const dec=new TextDecoder('utf-8',{fatal:true});
   while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();return reply(413,{error:'size'});}body+=dec.decode(value,{stream:true});}body+=dec.decode();
   const x=JSON.parse(body);
   if(!x||!Object.hasOwn(roles,x.action)||!x.payload||Array.isArray(x.payload)||typeof x.payload!=='object')return reply(400,{error:'invalid'});
   if(!p[roles[x.action]])return reply(403,{error:'denied'});
   const h={apikey:key,Authorization:token,'Content-Type':'application/json'};
   const u=await fetchImpl(API+'/auth/v1/user',{headers:h,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(5000)});
   if(!u.ok)return reply(401,{error:'denied'});
   const user=await u.json();if(!user?.id||user.is_anonymous===true)return reply(401,{error:'denied'});
   // Existing RPC remains authoritative for operator/session and scope.
   const r=await fetchImpl(API+'/rest/v1/rpc/'+(x.action.startsWith('billing_')?'aurea_admin_billing_v1':'aurea_admin_dispatch_v1'),{method:'POST',headers:h,body:JSON.stringify({p_action:x.action,p_payload:x.payload}),redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000)});
   if(!r.ok)return reply(r.status===401?401:403,{error:'denied'});
   return reply(200,await r.json());
  }catch{return reply(400,{error:'denied'});}
 };
}
module.exports={createHandler};
