'use strict';
const assert=require('node:assert/strict');
const {createEdgeRuntime,ORIGIN}=require('./runtime.cjs');
const {weeklyItems,domains}=require('../psychometric-item-bank.cjs');
const REF='ublzmoroanhlcgpnxilw';
const env={AUREA_EDGE_MANAGER_ENABLED:'true',AUREA_EDGE_MANAGER_APPROVED:'true',AUREA_EDGE_EMPLOYEE_ENABLED:'true',AUREA_EDGE_EMPLOYEE_APPROVED:'true',AUREA_STAGING_DATABASE_HOST:'aws-9-eu-west-1.pooler.supabase.com',AUREA_STAGING_DATABASE_USER:'aurea_limiter_login.'+REF,AUREA_EMPLOYEE_DATABASE_USER:'aurea_employee_login.'+REF,AUREA_STAGING_DATABASE_NAME:'postgres',AUREA_STAGING_DATABASE_PASSWORD:'p'.repeat(40),AUREUA:'',AUREA_EMPLOYEE_DATABASE_PASSWORD:'e'.repeat(40),AUREA_LIMITER_SECRET:'h'.repeat(64),AUREA_SUPABASE_URL:'https://'+REF+'.supabase.co',AUREA_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'};
const bank=weeklyItems('2026-11-23'),questions=bank.map((q,i)=>({code:q.code,wording:q.text,position:i+1,private_field:'hidden'}));
let sqlCalls=0,submits=0,rate=1,pools=[],badIdentity=false;
class Pool{constructor(c){this.c=c;pools.push(c)}async end(){}async connect(){const employee=this.c.user.startsWith('aurea_employee_login.');return {release(){},async query(sql,args){sqlCalls++;if(sql.includes('session_user as login_user'))return {rows:[{login_user:badIdentity?'postgres':employee?'aurea_employee_login':'aurea_limiter_login',active_user:employee?'aurea_employee_login':'aurea_rate_limiter',superuser:false,bypassrls:false}]};if(sql.includes('aurea_employee_invitation'))return {rows:[{result:{status:'ready',questions}}]};if(sql.includes('aurea_employee_submit')){submits++;assert.equal(JSON.parse(args[1]).length,6);return {rows:[{result:{status:'submitted'}}]}};return {rows:[{hits:rate}]}}}}}
const fetchImpl=async(url)=>url.endsWith('/auth/v1/user')?{ok:true,json:async()=>({id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'})}:url.endsWith('aurea_my_companies')?{ok:true,json:async()=>[]}:url.endsWith('aurea_manager_summary')?{ok:true,json:async()=>[{week_start:'2026-11-23',domain:'role_clarity',question_code:'A_CLARITY',response_count:5,favorable_percent:80}]}:{ok:false};
const token='a'.repeat(64),answers=bank.map(q=>({code:q.code,rating:4}));
const request=(route,data,opts={})=>new Request('https://example.invalid/'+route+(route.startsWith('manager-')?'?organization_id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa':''),{method:data?'POST':'GET',headers:{origin:ORIGIN,'content-type':'application/json',authorization:'Bearer a.b.c',...opts},...(data?{body:JSON.stringify(data)}:{})});
(async()=>{
 assert.equal(domains.length,10);assert.throws(()=>createEdgeRuntime({env:{...env,AUREA_EDGE_MANAGER_APPROVED:'false',AUREA_EDGE_EMPLOYEE_APPROVED:'false'},Pool}));
 assert.throws(()=>createEdgeRuntime({env:{...env,AUREA_EMPLOYEE_DATABASE_USER:'postgres'},Pool}));
 const r=createEdgeRuntime({env,Pool,fetchImpl});assert.equal(pools.length,2);assert.ok(pools.every(c=>c.ssl.rejectUnauthorized&&c.port===5432));
 let out=await r.handle(request('employee-invitation',{token}),'employee-invitation');assert.equal(out.status,200);const result=await out.json();assert.equal(result.questions.length,6);assert.equal(JSON.stringify(result).includes('private_field'),false);
 out=await r.handle(request('employee-submit',{token,answers}),'employee-submit');assert.equal(out.status,200);assert.equal(submits,1);
 for(const data of [{token,answers:answers.slice(0,4)},{token,answers:answers.map((a,i)=>i===0?{...a,extra:'x'}:a)},{token,answers,email:'private'},{token,answers:answers.map((a,i)=>i===0?{...a,code:'UNKNOWN'}:a)}])assert.equal((await r.handle(request('employee-submit',data),'employee-submit')).status,400);
 assert.equal(submits,1);const before=sqlCalls;assert.equal((await r.handle(request('employee-submit',{token,answers},{origin:'https://evil.invalid'}),'employee-submit')).status,403);assert.equal(sqlCalls,before);
 assert.equal((await r.handle(request('manager-summary',null),'manager-summary')).status,200);
 assert.equal((await r.handle(request('manager-session',null),'manager-session')).status,200);
 rate=301;assert.equal((await r.handle(request('employee-submit',{token,answers}),'employee-submit')).status,429);rate=1;
 badIdentity=true;assert.equal((await r.handle(request('employee-submit',{token,answers}),'employee-submit')).status,429);
 await r.close();console.log('PASS: isolated edge runtime, six questions, ten-domain bank, strict input, aggregate summary, session, throttling and role failure');
})().catch(e=>{console.error(e);process.exitCode=1});
