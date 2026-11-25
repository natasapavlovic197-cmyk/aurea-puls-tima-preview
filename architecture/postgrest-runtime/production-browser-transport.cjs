'use strict';
const {verifyPublic,verifyBrowser,assertBrowser}=require('./production-runtime-gate.cjs');
const {createManagerBridge}=require('../supabase-manager-bridge.cjs');
const {createAuthorizedManagerService}=require('../manager-authorized-service.cjs');
const BASE='https://dlibifwlmbfkboerlmqd.supabase.co';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function configured({url,key}={}){
 if(url!==BASE||typeof key!=='string'||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key))throw Error('Invalid production public configuration');
}
function createPostgrestTransport(config={}){
 const {url,key,role,fetchImpl=globalThis.fetch}=config;
 configured({url,key});
 verifyPublic({url,key});assertBrowser(role,config);
 const manager=createAuthorizedManagerService({bridge:createManagerBridge({url,key,fetchImpl})});
 const response=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
 return async function transport(input,opts={}){
  if(typeof input!=='string')throw Error('Unexpected request');
  if(role==='manager'&&(input===BASE+'/rest/v1/rpc/aurea_my_companies'||input===BASE+'/auth/v1/user'))return fetchImpl(input,opts);
  if(role==='employee'&&(input==='/api/employee/invitation'||input==='/api/employee/submit')){
   if(opts.method!=='POST'||typeof opts.body!=='string'||opts.body.length>8192)return response(400,{status:'unavailable'});
   try{
    const x=JSON.parse(opts.body),action=input.endsWith('/submit')?'submit':'invitation';
    if(!x||typeof x.token!=='string'||!/^[a-f0-9]{64}$/.test(x.token)||Object.keys(x).some(k=>!(action==='submit'?['token','answers']:['token']).includes(k)))return response(400,{status:'unavailable'});
    const r=await fetchImpl(BASE+'/rest/v1/rpc/aurea_employee_pulse_v2',{method:'POST',headers:{apikey:key,'content-type':'application/json'},body:JSON.stringify({p_action:action,p_token:x.token,p_answers:action==='submit'?x.answers:null}),credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(7000)});
    if(!r.ok)return response(503,{status:'unavailable'});
    const result=await r.json();
    if(result?.status==='try_later')return response(429,{status:'try_later'});
    if(action==='submit')return response(result?.status==='submitted'?200:400,{status:result?.status==='submitted'?'submitted':'unavailable'});
    if(result?.status!=='ready'||!Array.isArray(result.questions)||result.questions.length!==6)return response(404,{status:'unavailable'});
    return response(200,{status:'ready',questions:result.questions.map(({code,wording,position})=>({code,wording,position}))});
   }catch{return response(503,{status:'unavailable'})}
  }
  if(role==='manager'&&input.startsWith('/api/manager-workspace?')){
   try{
    const parsed=new URL(input,'https://local.invalid'),ids=parsed.searchParams.getAll('organization_id');
    const auth=opts.headers?.authorization;
    if(ids.length!==1||!UUID.test(ids[0])||typeof auth!=='string'||!/^Bearer [A-Za-z0-9_.-]+$/.test(auth))return response(403,{status:'unavailable'});
    const event={headers:{authorization:auth}},org=ids[0];
    if(opts.method==='GET')return response(200,{status:'ready',...await manager.overview(event,org)});
    if(opts.method==='POST'&&typeof opts.body==='string'&&opts.body.length<=16000)return response(200,{status:'saved',...await manager.save(event,org,JSON.parse(opts.body))});
    return response(405,{status:'unavailable'});
   }catch{return response(403,{status:'unavailable'})}
  }
  throw Error('Unexpected request');
 };
}
module.exports={createPostgrestTransport};
