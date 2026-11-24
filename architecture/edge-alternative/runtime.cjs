'use strict';
const {createHash}=require('node:crypto');
const {poolerConfig,REF}=require('../staging-pooler-config.cjs');
const {createRestrictedLimiterQuery}=require('../restricted-pg-query.cjs');
const {createDurableLimiter}=require('../postgres-durable-limiter.cjs');
const {createEmployeeDurableRateLimit}=require('../employee-durable-rate-limit.cjs');
const {createRestrictedEmployeeAdapter}=require('./employee-adapter.cjs');
const {createEmployeeGateway}=require('./employee-gateway.cjs');
const {createManagerRuntime,createManagerWorkspaceRuntime}=require('../manager-runtime.cjs');
const {createManagerBridge}=require('../supabase-manager-bridge.cjs');
const {anchors,rotation,weeklyItems,validateBank}=require('../psychometric-item-bank.cjs');
const ORIGIN='https://aurea-puls-tima-preview.netlify.app';
const BASE='https://'+REF+'.supabase.co';
const HASH=/^[a-f0-9]{64}$/;
const CODES=new Set([...anchors,...rotation.flat()].map(x=>x.code));
const digest=v=>createHash('sha256').update(v).digest('hex');
const cors={'access-control-allow-origin':ORIGIN,'access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':'authorization, apikey, content-type','cache-control':'no-store','referrer-policy':'no-referrer','vary':'Origin','content-type':'application/json'};
const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers:cors});
function approved(env,kind){return env['AUREA_EDGE_'+kind+'_ENABLED']==='true'&&env['AUREA_EDGE_'+kind+'_APPROVED']==='true'}
function createEdgeRuntime({env,Pool,fetchImpl=globalThis.fetch}={}){
 if(!env||typeof Pool!=='function'||env.AUREA_SUPABASE_URL!==BASE||!approved(env,'MANAGER')&&!approved(env,'EMPLOYEE'))throw Error('Runtime disabled');
 const options={...poolerConfig(env),max:2,connectionTimeoutMillis:4000,idleTimeoutMillis:10000};
 const p=env.AUREA_STAGING_DATABASE_PASSWORD,s=env.AUREA_LIMITER_SECRET,k=env.AUREA_SUPABASE_PUBLISHABLE_KEY;
 if(typeof p!=='string'||p.length<24||typeof s!=='string'||s.length<32||p===s||typeof k!=='string'||!k.startsWith('sb_publishable_'))throw Error('Missing restricted configuration');
 const ep=env.AUREA_EMPLOYEE_DATABASE_PASSWORD;
 if(approved(env,'EMPLOYEE')&&(env.AUREA_EMPLOYEE_DATABASE_USER!=='aurea_employee_login.'+REF||typeof ep!=='string'||ep.length<24||ep===p||ep===s))throw Error('Missing separate employee login');
 validateBank();
 const limiterPool=new Pool({...options,password:p});
 let employeePool;
 try{
 const query=createRestrictedLimiterQuery({pool:limiterPool});
 const globalLimit=createDurableLimiter({query,secret:s,maxHits:300,windowSeconds:300});
 const manager=createManagerRuntime({supabaseUrl:BASE,publishableKey:k,fetchImpl,query,limiterSecret:s});
 const workspace=createManagerWorkspaceRuntime({supabaseUrl:BASE,publishableKey:k,fetchImpl,query,limiterSecret:s});
 const bridge=createManagerBridge({url:BASE,key:k,fetchImpl});
 const sessionLimit=createDurableLimiter({query,secret:s,maxHits:20,windowSeconds:300});
 let employee;
 if(approved(env,'EMPLOYEE')){
 employeePool=new Pool({...options,user:'aurea_employee_login.'+REF,password:ep});
 employee=createEmployeeGateway({adapter:createRestrictedEmployeeAdapter({pool:employeePool}),rateLimit:createEmployeeDurableRateLimit({query,secret:s})});
 }
 async function handle(req,route){
 try{
 if(req.headers.get('origin')!==ORIGIN)return reply(403,{status:'unavailable'});
 if(!['employee-invitation','employee-submit','manager-summary','manager-workspace','manager-session'].includes(route))return reply(404,{status:'unavailable'});
 const isEmployee=route.startsWith('employee-');
 if(!approved(env,isEmployee?'EMPLOYEE':'MANAGER'))return reply(503,{status:'unavailable'});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(isEmployee?req.method!=='POST':route==='manager-workspace'?!['GET','POST'].includes(req.method):req.method!=='GET')return reply(405,{status:'unavailable'});
 // No trusted client IP is assumed at the Edge boundary. Use a shared ceiling
 // plus a credential-derived bucket; never trust X-Forwarded-For from clients.
 if(!await globalLimit({ip:'edge-global',scope:isEmployee?'edge-employee':'edge-manager'}))return reply(429,{status:'try_later'});
 let body='',identity;
 if(req.method==='POST'){
 if(!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type')||''))return reply(415,{status:'invalid'});
 const reader=req.body?.getReader();if(!reader)return reply(400,{status:'invalid'});
 const decoder=new TextDecoder('utf-8',{fatal:true});let size=0;
 try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();return reply(400,{status:'invalid'})}body+=decoder.decode(value,{stream:true})}body+=decoder.decode()}finally{reader.releaseLock()}
 }
 const headers=Object.fromEntries(req.headers.entries());
 if(isEmployee){
 let input;try{input=JSON.parse(body)}catch{return reply(400,{status:'invalid'})}
 const submit=route==='employee-submit';
 if(!input||typeof input!=='object'||Array.isArray(input)||!HASH.test(input.token||'')||Object.keys(input).some(x=>!(submit?['token','answers']:['token']).includes(x)))return reply(400,{status:'invalid'});
 if(submit&&(!Array.isArray(input.answers)||input.answers.length!==6||input.answers.some(a=>!a||!CODES.has(a.code))))return reply(400,{status:'invalid'});
 const hash=digest(input.token);identity=hash;
 body=JSON.stringify(submit?{action:'submit',hash,answers:input.answers}:{action:'invitation',hash});
 }else{
 const auth=headers.authorization||'';
 if(!/^Bearer [A-Za-z0-9_.-]{1,8192}$/.test(auth))return reply(401,{status:'unauthorized'});
 identity=digest(auth);
 }
 const ids=new URL(req.url).searchParams.getAll('organization_id');
 if(!isEmployee&&route!=='manager-session'&&ids.length!==1)return reply(400,{status:'invalid'});
 const event={httpMethod:req.method,headers,body,isBase64Encoded:false,queryStringParameters:{organization_id:ids[0]},requestContext:{identity:{sourceIp:identity}}};
 // sourceIp is the legacy core interface name; here it holds a credential digest,
 // not an IP. Core rate limiter HMACs it before writing counters.
 if(route==='manager-session'){
 if(!await sessionLimit({ip:identity,scope:'manager-session'}))return reply(429,{status:'try_later'});
 const user=await bridge.authenticate(event);if(!user)return reply(401,{status:'unauthorized'});
 const r=await fetchImpl(BASE+'/rest/v1/rpc/aurea_my_companies',{method:'POST',headers:{apikey:k,authorization:'Bearer '+user.token,'content-type':'application/json'},body:'{}',signal:AbortSignal.timeout(5000)});
 if(!r.ok)return reply(403,{status:'unavailable'});
 const companies=await r.json();if(!Array.isArray(companies)||companies.length>100)return reply(503,{status:'unavailable'});
 return reply(200,{user_id:user.id,companies});
 }
 const result=await (isEmployee?employee:route==='manager-summary'?manager:workspace)(event);
 if(route==='employee-invitation'&&result.statusCode===200){
 const data=JSON.parse(result.body);const codes=data.questions.map(x=>x.code);
 // Match one of the four canonical sets, not a caller-selected questionnaire.
 const weeks=['2026-11-23','2026-11-30','2026-12-07','2026-12-14'];
 if(!weeks.some(w=>{const bank=weeklyItems(w);return data.questions.every(q=>{const i=bank[q.position-1];return i&&q.code===i.code&&q.wording===i.text})})||new Set(codes).size!==6)return reply(503,{status:'unavailable'});
 }
 return new Response(result.body,{status:result.statusCode,headers:cors});
 }catch{return reply(503,{status:'unavailable'})}
 }
 return Object.freeze({handle,close:()=>Promise.allSettled([limiterPool.end(),...(employeePool?[employeePool.end()]:[])])});
 }catch(e){void limiterPool.end().catch(()=>{});if(employeePool)void employeePool.end().catch(()=>{});throw e}
}
module.exports={createEdgeRuntime,ORIGIN};
