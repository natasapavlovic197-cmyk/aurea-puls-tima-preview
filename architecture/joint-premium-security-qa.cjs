'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {createStagingServer}=require('./staging-manager-server.cjs');
const {createEmployeeRuntimeHttp}=require('./employee-runtime-http.cjs');
const {createEmployeeGateway}=require('./employee-server-gateway.cjs');
const {SQL}=require('./postgres-durable-limiter.cjs');
const {weeklyItems}=require('./psychometric-item-bank.cjs');
const {chromium}=require('playwright');
const orgA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',orgB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',userA='11111111-1111-4111-8111-111111111111',userB='22222222-2222-4222-8222-222222222222',actionA='33333333-3333-4333-8333-333333333333',actionB='44444444-4444-4444-8444-444444444444';
const baseUrl='https://ublzmoroanhlcgpnxilw.supabase.co',week='2026-11-23',secret='QA_PRIVATE_LIMITER_SENTINEL_1234567890',privateField='QA_PRIVATE_RECIPIENT_SENTINEL';
const items=weeklyItems(week),tokens=Array.from({length:12},(_,i)=>crypto.createHash('sha256').update('synthetic '+i).digest('hex'));
const hash=t=>crypto.createHash('sha256').update(t).digest('hex');
const invites=new Map(tokens.map((t,i)=>[hash(t),{org:i<6?orgA:orgB,used:false}]));
const answers=new Map([[orgA,[]],[orgB,[]]]),actions=new Map([[orgA,[]],[orgB,[]]]);
const auth=new Map([['qa-a',{id:userA,org:orgA}],['qa-b',{id:userB,org:orgB}]]);
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json'}});
let closed=false,fail=false,throttle=false;
const fetchImpl=async(url,opts)=>{
 const u=auth.get(opts.headers.authorization?.slice(7));if(!u)return json({},401);
 if(url.endsWith('/auth/v1/user'))return json({id:u.id});
 const p=JSON.parse(opts.body);if(p.p_organization_id!==u.org)return json({},403);
 if(fail)return json({message:secret},503);
 if(url.endsWith('aurea_manager_publications_v2'))return json(!closed?[]:items.flatMap(q=>{
 const valid=answers.get(u.org).map(a=>a.find(x=>x.code===q.code).rating).filter(v=>v<=5);
 return valid.length<5?[]:[{week_start:week,item_code:q.code,item_version:1,domain:q.domain,response_count:valid.length,favorable_percent:100*valid.filter(v=>v>=4).length/valid.length,closed:true,recipient_address:privateField}];
 }));
 if(url.endsWith('aurea_manager_actions'))return json(actions.get(u.org).map(a=>({...a,private_email:privateField})));
 if(url.endsWith('aurea_manager_save_action')){
 const list=actions.get(u.org),id=p.p_action_id||(u.org===orgA?actionA:actionB);
 if(p.p_action_id&&!list.some(a=>a.id===id))return json({},403);
 const a={id,description:p.p_description,due_on:p.p_due_on,status:p.p_status};
 actions.set(u.org,[a]);return json(id);
 }throw Error('unexpected RPC');
};
const employeeHandler=createEmployeeRuntimeHttp(createEmployeeGateway({rateLimit:async()=>!throttle,adapter:{
 invitation:async h=>{const i=invites.get(h);return !i||i.used||closed?{status:'unavailable'}:{status:'ready',questions:items.map((q,n)=>({code:q.code,wording:q.text,position:n+1,email:privateField}))}},
 submit:async(h,a)=>{const i=invites.get(h);if(!i||i.used||closed)return {status:'unavailable'};i.used=true;answers.get(i.org).push(a);return {status:'submitted'}}
}}));
function checkAssets(){
 for(const [source,built,locked] of [['rukovodilac/index.html','index.html','49a9839e8a007a588d2150e2ff79bbc3a88f3324'],['zaposleni/index.html','employee.html','af3b1944cfa30c71e1bb3c0adcb2c8005193c125']]){
 const b=fs.readFileSync(source);assert.equal(crypto.createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex'),locked);
 const styles=s=>s.match(/<style\b[^>]*>[\s\S]*?<\/style>/g);
 assert.deepEqual(styles(b.toString()),styles(fs.readFileSync('dist-staging-manager/'+built,'utf8')));
 }
 for(const f of fs.readdirSync('dist-staging-manager')){
 const s=fs.readFileSync('dist-staging-manager/'+f,'utf8');
 for(const forbidden of [secret,privateField,'AUREA_STAGING_DATABASE_PASSWORD','AUREA_EMPLOYEE_DATABASE_PASSWORD','AUREA_LIMITER_SECRET','SUPABASE_ACCESS_TOKEN','DEMO_N','favorableCounts','sessionStorage.getItem(AUREA_DEMO_ACTIVITY_KEY)'])assert.ok(!s.includes(forbidden),f+' contains forbidden marker '+forbidden);
 }
}
(async()=>{
 checkAssets();
 const server=createStagingServer({env:{AUREA_SUPABASE_URL:baseUrl,AUREA_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_qa',AUREA_LIMITER_SECRET:secret},query:async sql=>{assert.equal(sql,SQL);return {rows:[{hits:1}]}},fetchImpl,employeeHandler});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
 const base='http://127.0.0.1:'+server.address().port;
 const request=async(path,opts={})=>{const r=await fetch(base+path,opts),body=await r.text();assert.equal(r.headers.get('cache-control'),'no-store');for(const s of [secret,privateField])assert.ok(!body.includes(s));return {status:r.status,body}};
 const employee=(path,body)=>request('/api/employee/'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 const manager=(org,token,input)=>request('/api/manager-workspace?organization_id='+org,{method:input?'POST':'GET',headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(input?{body:JSON.stringify(input)}:{})});
 for(const path of ['/.env','/package.json','/architecture/start-staging-manager.cjs','/../private.txt'])assert.equal((await request(path)).status,404);
 assert.equal((await manager(orgA,'fake')).status,403);assert.equal((await manager(orgB,'qa-a')).status,403);assert.equal((await manager(orgA,'qa-b')).status,403);
 assert.equal((await employee('invitation',{token:'wrong'})).status,400);
 assert.equal((await employee('invitation',{token:tokens[0],email:'x'})).status,400);
 throttle=true;assert.equal((await employee('invitation',{token:tokens[0]})).status,429);throttle=false;
 const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();
 await page.goto(base+'/employee#'+tokens[0]);await page.locator('.question').waitFor();assert.equal(new URL(page.url()).hash,'');
 for(let j=0;j<6;j++){await page.locator('input[name=answer][value="'+(j===0?6:4)+'"]').check();await page.locator('#next').click()}
 await page.getByText('Vaši odgovori su primljeni.',{exact:false}).waitFor();assert.equal((await employee('invitation',{token:tokens[0]})).status,404);
 for(let i=1;i<12;i++){
 const a=items.map((q,j)=>({code:q.code,rating:i===1&&j===0?6:i<6?4:2}));
 assert.equal((await employee('submit',{token:tokens[i],answers:a.slice(0,4)})).status,400);
 assert.equal((await employee('submit',{token:tokens[i],answers:a})).status,200);
 assert.notEqual((await employee('submit',{token:tokens[i],answers:a})).status,200);
 }
 assert.equal(JSON.parse((await manager(orgA,'qa-a')).body).report.history.length,0);
 closed=true;
 const a=JSON.parse((await manager(orgA,'qa-a')).body),b=JSON.parse((await manager(orgB,'qa-b')).body);
 assert.equal(a.report.history.length,5);assert.equal(b.report.history.length,6);
 assert.ok(a.report.history.every(x=>x.favorablePercent===100&&x.responseCount===6&&x.itemVersion===1));
 assert.ok(b.report.history.every(x=>x.favorablePercent===0&&x.itemVersion===1));
 assert.equal((await manager(orgA,'qa-a',{description:'QA plan A',status:'open'})).status,200);
 assert.equal((await manager(orgB,'qa-b',{description:'QA plan B',status:'open'})).status,200);
 assert.equal((await manager(orgB,'qa-a',{description:'denied',status:'open'})).status,403);
 assert.equal((await manager(orgA,'qa-a',{description:'denied',actionId:actionB,status:'done'})).status,403);
 assert.equal((await manager(orgA,'qa-a',{description:'QA plan A',actionId:actionA,status:'done'})).status,200);
 const aa=JSON.parse((await manager(orgA,'qa-a')).body).activities;assert.deepEqual(aa,[{id:actionA,description:'QA plan A',due_on:null,status:'done'}]);
 fail=true;assert.equal((await manager(orgA,'qa-a')).status,403);fail=false;
 await context.close();
 console.log('PASS JOINT: same server, employee browser -> six synthetic submissions per tenant -> closed publication, threshold, version, two-way isolation, activity read/write denial, token replay, throttle, secret allowlist and locked CSS');
 }finally{await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
