'use strict';
const assert=require('node:assert/strict');
const {randomUUID,randomBytes}=require('node:crypto');
const cfg=require('./postgrest-runtime/staging-public-config.cjs');
const {createPostgrestTransport}=require('./postgrest-runtime/browser-transport.cjs');
const {createCompanyReader}=require('./manager-company-reader.cjs');
const {weeklyItems}=require('./psychometric-item-bank.cjs');
const root='https://api.supabase.com/v1/projects/ublzmoroanhlcgpnxilw', pat=process.env.SUPABASE_ACCESS_TOKEN;
const week='2026-11-23';
async function sql(query){const r=await fetch(root+'/database/query',{method:'POST',redirect:'error',signal:AbortSignal.timeout(25000),headers:{authorization:'Bearer '+pat,'content-type':'application/json'},body:JSON.stringify({query})});if(!r.ok)throw Error('SQL HTTP '+r.status);return r.json()}
async function main(){
 if(!pat?.startsWith('sbp_fc')||cfg.url!=='https://ublzmoroanhlcgpnxilw.supabase.co'||process.env.GITHUB_REF!=='refs/heads/integration/employee-ten-domains-step5'||process.env.GITHUB_REPOSITORY!=='natasapavlovic197-cmyk/aurea-puls-tima-preview')throw Error('Staging gate');
 const p=await fetch(root,{headers:{authorization:'Bearer '+pat},redirect:'error',signal:AbortSignal.timeout(10000)});if(!p.ok||(await p.json()).name!=='aurea-puls-staging')throw Error('Project gate');
 const ids=[0,1].map(()=>{const u=randomUUID(),o=randomUUID();return {u,o,c:randomUUID(),email:'qa-manager-'+u+'@example.invalid',name:'SYNTHETIC MANAGER HTTPS '+o,pw:randomBytes(32).toString('hex'),jwt:null}});
 for(const x of ids)console.log('Synthetic cleanup identifiers: '+x.o+' '+x.u);
 const codes=weeklyItems(week).map(x=>x.code);assert.equal(codes.length,6);assert.ok(codes.every(x=>/^[A-Z_]+$/.test(x)));
 const transport=createPostgrestTransport(cfg),companies=createCompanyReader({...cfg,fetchImpl:transport});
 const call=async(x,o,method='GET',body)=>transport('/api/manager-workspace?organization_id='+o,{method,headers:{authorization:'Bearer '+x.jwt},...(body?{body:JSON.stringify(body)}:{})});
 const direct=async(x,rpc,body)=>fetch(cfg.url+'/rest/v1/rpc/'+rpc,{method:'POST',headers:{apikey:cfg.key,authorization:'Bearer '+x.jwt,'content-type':'application/json'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(10000)});
 try{
 await sql('BEGIN;'+ids.map((x,j)=>`
 INSERT INTO auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change,email_change_token_new,email_change_token_current,reauthentication_token,phone_change,phone_change_token)
 VALUES('00000000-0000-0000-0000-000000000000','${x.u}','authenticated','authenticated','${x.email}',extensions.crypt('${x.pw}',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','','','');
 INSERT INTO auth.identities(provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at) VALUES('${x.u}','${x.u}',jsonb_build_object('sub','${x.u}','email','${x.email}','email_verified',true),'email',now(),now(),now());
 INSERT INTO aurea_private.organizations(id,name) VALUES('${x.o}','${x.name}');
 INSERT INTO aurea_private.memberships(organization_id,user_id,role) VALUES('${x.o}','${x.u}','manager');
 INSERT INTO aurea_private.cycles(id,organization_id,week_start,state,model_version) VALUES('${x.c}','${x.o}','${week}','open',2);
 INSERT INTO aurea_private.cycle_questions(cycle_id,question_id,position) SELECT '${x.c}',q.id,v.pos::smallint FROM (VALUES ${codes.map((k,i)=>"('"+k+"',"+(i+1)+")").join(',')}) v(code,pos) JOIN aurea_private.questions q ON q.code=v.code AND q.model_version=2 AND q.active;
 WITH rr AS (INSERT INTO aurea_private.responses(cycle_id) SELECT '${x.c}' FROM generate_series(1,6) RETURNING id), numbered AS (SELECT id,row_number() OVER(ORDER BY id) n FROM rr)
 INSERT INTO aurea_private.response_answers(response_id,question_id,rating,not_applicable) SELECT rr.id,cq.question_id,CASE WHEN cq.position=6 AND rr.n<=2 THEN NULL WHEN ${j}=0 THEN 4 ELSE 2 END, cq.position=6 AND rr.n<=2 FROM numbered rr CROSS JOIN aurea_private.cycle_questions cq WHERE cq.cycle_id='${x.c}';
 `).join('')+'COMMIT;');
 for(const x of ids){const response=await fetch(cfg.url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:cfg.key,'content-type':'application/json'},body:JSON.stringify({email:x.email,password:x.pw}),redirect:'error',signal:AbortSignal.timeout(12000)});assert.equal(response.status,200,'real auth');const session=await response.json();assert.equal(session.user.id,x.u);assert.ok(session.access_token);x.jwt=session.access_token;assert.deepEqual(await companies(x.jwt),[{id:x.o,name:x.name}]);const v=await call(x,x.o);assert.equal(v.status,200);assert.equal((await v.json()).report.history.length,0);}
 console.log('PASS: two real password sessions, own company only, open cycles hidden');
 await sql('BEGIN;'+ids.map(x=>`UPDATE aurea_private.cycles SET state='closed' WHERE id='${x.c}' AND organization_id='${x.o}';`).join('')+'COMMIT;');
 for(let j=0;j<2;j++){const x=ids[j],other=ids[1-j];const v=await call(x,x.o);assert.equal(v.status,200);const data=await v.json();assert.equal(data.report.history.length,5);assert.ok(data.report.history.every(z=>z.responseCount===6&&z.favorablePercent===(j===0?100:0)));assert.ok(!data.report.history.some(z=>z.itemCode===codes[5]));assert.deepEqual(data.activities,[]);
 const denied=await call(x,other.o);assert.equal(denied.status,403);assert.deepEqual(await denied.json(),{status:'unavailable'});
 for(const rpc of ['aurea_manager_publications_v2','aurea_manager_actions']){const rr=await direct(x,rpc,{p_organization_id:other.o});assert.ok([401,403].includes(rr.status));}
 const body={description:'Synthetic QA activity',cycleId:x.c,status:'open'};const save=await call(x,x.o,'POST',body);assert.equal(save.status,200);const {id}=await save.json();assert.ok(/^[0-9a-f-]{36}$/.test(id));const update=await call(x,x.o,'POST',{...body,actionId:id,status:'done'});assert.equal(update.status,200);
 const read=await call(x,x.o);assert.equal(read.status,200);assert.ok((await read.json()).activities.some(a=>a.id===id&&a.status==='done'));
 const blocked=await call(other,x.o,'POST',{...body,actionId:id});assert.equal(blocked.status,403);
 const blockedDirect=await direct(other,'aurea_manager_save_action',{p_organization_id:x.o,p_description:'Synthetic forbidden edit',p_action_id:id,p_status:'open'});assert.ok([401,403].includes(blockedDirect.status));
 const after=await call(x,x.o);assert.ok((await after.json()).activities.some(a=>a.id===id&&a.status==='done'));
 }
 console.log('PASS: five thresholded closed aggregates per tenant, distinct scores, four-response item hidden, two-way read/write denial, activity create/update/read');
 }finally{
 for(const x of ids)if(x.jwt){try{await fetch(cfg.url+'/auth/v1/logout?scope=global',{method:'POST',headers:{apikey:cfg.key,authorization:'Bearer '+x.jwt},redirect:'error',signal:AbortSignal.timeout(8000)})}catch{}}
 await sql('BEGIN;'+ids.map(x=>`
 DELETE FROM aurea_private.manager_actions WHERE organization_id='${x.o}' AND created_by='${x.u}' AND EXISTS(SELECT 1 FROM aurea_private.organizations WHERE id='${x.o}' AND name='${x.name}');
 DELETE FROM aurea_private.response_answers WHERE response_id IN (SELECT r.id FROM aurea_private.responses r JOIN aurea_private.cycles c ON c.id=r.cycle_id JOIN aurea_private.organizations o ON o.id=c.organization_id WHERE c.id='${x.c}' AND o.id='${x.o}' AND o.name='${x.name}');
 DELETE FROM aurea_private.responses WHERE cycle_id='${x.c}' AND EXISTS(SELECT 1 FROM aurea_private.cycles c JOIN aurea_private.organizations o ON o.id=c.organization_id WHERE c.id='${x.c}' AND o.id='${x.o}' AND o.name='${x.name}');
 DELETE FROM aurea_private.cycle_questions WHERE cycle_id='${x.c}' AND EXISTS(SELECT 1 FROM aurea_private.organizations WHERE id='${x.o}' AND name='${x.name}');
 DELETE FROM aurea_private.cycles WHERE id='${x.c}' AND organization_id='${x.o}' AND EXISTS(SELECT 1 FROM aurea_private.organizations WHERE id='${x.o}' AND name='${x.name}');
 DELETE FROM aurea_private.memberships WHERE organization_id='${x.o}' AND user_id='${x.u}';
 DELETE FROM aurea_private.organizations WHERE id='${x.o}' AND name='${x.name}';
 DELETE FROM auth.users WHERE id='${x.u}' AND email='${x.email}';
 `).join('')+'COMMIT;');
 for(const x of ids){const rows=await sql(`SELECT (SELECT count(*)::int FROM auth.users WHERE id='${x.u}') users,(SELECT count(*)::int FROM auth.sessions WHERE user_id='${x.u}') sessions,(SELECT count(*)::int FROM aurea_private.organizations WHERE id='${x.o}') organizations,(SELECT count(*)::int FROM aurea_private.manager_actions WHERE organization_id='${x.o}') activities,(SELECT count(*)::int FROM aurea_private.responses WHERE cycle_id='${x.c}') responses`);assert.deepEqual(rows,[{users:0,sessions:0,organizations:0,activities:0,responses:0}]);}
 console.log('PASS: synthetic identities, sessions, organizations, activities and responses removed');
 }
}
main().catch(e=>{console.error('Manager E2E failed: '+(e instanceof assert.AssertionError?'assertion '+(e.message.split('\n')[0].slice(0,80)): /^SQL HTTP \d+$/.test(e.message)?e.message:'execution error'));process.exitCode=1});
