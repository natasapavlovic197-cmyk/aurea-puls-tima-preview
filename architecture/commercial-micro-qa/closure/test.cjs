'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),{pathToFileURL}=require('node:url');
const {chromium}=require('playwright-core');
const out=path.resolve(process.argv[2]),db=process.env.QA_DB,rest='http://127.0.0.1:54321',secret=process.env.QA_JWT_SECRET;
assert.ok(db?.startsWith('aurea-closure-')&&secret?.length>=32);
const stage=path.join(out,'staging'),pub=path.join(stage,'publish'),org='00000000-0000-4000-8000-000000000011',other='00000000-0000-4000-8000-000000000012';
const employee='00000000-0000-4000-8000-000000000021',manager='00000000-0000-4000-8000-000000000022',sid='00000000-0000-4000-8000-000000000031',msid='00000000-0000-4000-8000-000000000032';
const configPath=path.join(pub,'puls-app/edukacija/education-config.js');
const cfg=JSON.parse(fs.readFileSync(configPath,'utf8').match(/Object\.freeze\((.*)\);/)[1]);assert.equal(cfg.enabled,false);
const json=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const token=(sub=employee,session_id=sid,exp=Math.floor(Date.now()/1000)+600,role='authenticated')=>{const s=json({alg:'HS256',typ:'JWT'})+'.'+json({sub,session_id,role,aud:'authenticated',exp,iat:Math.floor(Date.now()/1000)});return s+'.'+crypto.createHmac('sha256',secret).update(s).digest('base64url')};
const sql=s=>cp.execFileSync('docker',['exec','-i',db,'psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','aurea_fixture','-c',s],{encoding:'utf8'});
const raw=global.fetch;
const rpc=async(t,o=org)=>raw(rest+'/rpc/aurea_education_access_v1',{method:'POST',headers:{authorization:'Bearer '+t,'content-type':'application/json'},body:JSON.stringify({p_org:o})});
const answer=async(t,o=org)=>{const r=await rpc(t,o);assert.equal(r.status,200,await r.clone().text());return r.json()};
(async()=>{
 assert.equal(await answer(token()),false,'default OFF');
 sql("INSERT INTO aurea_admin.education_stage_grants_v1(user_id,organization_id,member_role,expires_at) VALUES ('"+employee+"','"+org+"','employee',now()+interval '1 hour'),('"+manager+"','"+org+"','manager',now()+interval '1 hour')");
 assert.equal(await answer(token()),true);assert.equal(await answer(token(manager,msid)),true);assert.equal(await answer(token(),other),false);assert.equal(await answer(token(employee,msid)),false);
 assert.equal((await rpc(token()+'x')).status,401);assert.equal((await rpc(token(employee,sid,Math.floor(Date.now()/1000)-600))).status,401);
 assert.ok((await raw(rest+'/rpc/aurea_education_access_v1',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({p_org:org})})).status>=400);
 sql("UPDATE aurea_admin.education_stage_grants_v1 SET created_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' WHERE user_id='"+employee+"'");
 assert.equal(await answer(token()),false);sql("UPDATE aurea_admin.education_stage_grants_v1 SET created_at=now(),expires_at=now()+interval '1 hour' WHERE user_id='"+employee+"'");
 sql("UPDATE auth.sessions SET not_after=now()-interval '1 second' WHERE id='"+sid+"'");assert.equal(await answer(token()),false);sql("UPDATE auth.sessions SET not_after=NULL WHERE id='"+sid+"'");
 console.log('PASS real PostgREST signed JWT, default deny, two Micro roles, cross-tenant, forged/expired JWT and expired grant/session');
 const fn=await import(pathToFileURL(path.join(stage,'server-functions/aurea-education.mjs')));
 assert.equal(fn.config.path,'/api/education');
 const fixtureOrigin='https://qa-aurea.example.invalid';
 process.env.AUREA_ENVIRONMENT='staging';process.env.AUREA_SUPABASE_URL=cfg.url;process.env.AUREA_SUPABASE_PUBLISHABLE_KEY=cfg.key;process.env.AUREA_STAGE_EDUCATION_ORIGIN=fixtureOrigin;
 const req=(t=token(),o=org,origin=fixtureOrigin)=>new Request(fixtureOrigin+'/api/education',{method:'POST',headers:{origin,authorization:'Bearer '+t,'content-type':'application/json'},body:JSON.stringify({organizationId:o})});
 assert.equal((await fn.default(req())).status,403);
 process.env.AUREA_STAGE_EDUCATION_APPROVAL='approved-isolated-staging-education-v1';process.env.AUREA_ENABLE_STAGE_EDUCATION='true';
 global.fetch=(url,opts)=>{assert.equal(String(url),cfg.url+'/rest/v1/rpc/aurea_education_access_v1');return raw(rest+'/rpc/aurea_education_access_v1',opts)};
 assert.equal((await fn.default(req(token(),other))).status,403);assert.equal((await fn.default(req(token()+'x'))).status,403);assert.equal((await fn.default(req(token(),org,'https://wrong.example.invalid'))).status,403);
 const ok=await fn.default(req());assert.equal(ok.status,200);assert.match(ok.headers.get('cache-control'),/no-store/);assert.match(ok.headers.get('content-security-policy'),/connect-src 'none'/);const locked=await ok.text();assert.ok(locked.includes('signatureEducationGuard'));
 console.log('PASS compiled server function OFF, origin, signed authorization, no-store and actual locked document');
 const csp=fs.readFileSync(path.join(pub,'_headers'),'utf8').split('\n\n').find(b=>b.startsWith('/puls-app/edukacija/*\n')).split('\n').find(x=>x.includes('Content-Security-Policy:')).split('Content-Security-Policy: ')[1];
 const redirects=fs.readFileSync(path.join(pub,'_redirects'),'utf8');assert.match(redirects,/\/signature-education\.html \/puls-app\/edukacija\/ 302!/);
 assert.ok(!fs.existsSync(path.join(pub,'signature-education.html')));
 const browser=await chromium.launch({headless:true,executablePath:process.env.QA_CHROME,args:['--no-sandbox']});
 try{
 const ctx=await browser.newContext({viewport:{width:390,height:844}});const page=await ctx.newPage();const unexpected=[];
 await ctx.route('**/*',async route=>{
  const rq=route.request(),u=new URL(rq.url());
  if(u.origin===cfg.url&&rq.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':fixtureOrigin,'access-control-allow-methods':'POST,GET,OPTIONS','access-control-allow-headers':'*'}});
  if(u.origin===cfg.url&&u.pathname==='/auth/v1/token'){
   const b=rq.postDataJSON();assert.equal(b.email,'qa-employee@example.invalid');return route.fulfill({status:200,headers:{'access-control-allow-origin':fixtureOrigin,'content-type':'application/json'},json:{access_token:token(),refresh_token:'synthetic-refresh',token_type:'bearer',expires_in:600,user:{id:employee,aud:'authenticated',role:'authenticated',email:'qa-employee@example.invalid',created_at:new Date().toISOString(),app_metadata:{},user_metadata:{}}}});
  }
  if(u.origin!==fixtureOrigin){unexpected.push(u.origin+u.pathname);return route.abort();}
  if(u.pathname==='/api/education'){
   const h=rq.headers();const resp=await fn.default(new Request(rq.url(),{method:'POST',headers:h,body:rq.postData()}));return route.fulfill({status:resp.status,headers:Object.fromEntries(resp.headers),body:await resp.text()});
  }
  if(u.pathname==='/signature-education.html')return route.fulfill({status:302,headers:{location:'/puls-app/edukacija/','cache-control':'no-store'}});
  let rel=u.pathname.slice(1);if(rel.endsWith('/'))rel+='index.html';const f=path.join(pub,rel);
  if(!f.startsWith(pub+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile())return route.fulfill({status:404});
  const typ=f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':'text/html; charset=utf-8';
  let body=fs.readFileSync(f);
  if(f===configPath)body=Buffer.from('globalThis.AUREA_EDUCATION_CONFIG=Object.freeze('+JSON.stringify({...cfg,origin:fixtureOrigin,enabled:true})+');');
  return route.fulfill({status:200,headers:{'content-type':typ,'content-security-policy':csp,'cache-control':'no-store','referrer-policy':'no-referrer'},body});
 });
 await page.goto(fixtureOrigin+'/signature-education.html');assert.equal(new URL(page.url()).pathname,'/puls-app/edukacija/');
 await page.locator('#org').fill(org);await page.locator('#email').fill('qa-employee@example.invalid');await page.locator('#password').fill('fixture-password');await page.locator('#submit').click();
 const frame=page.frameLocator('iframe');await frame.locator('#scenario-hub').waitFor({state:'visible',timeout:25000});
 assert.equal(await page.locator('iframe').getAttribute('sandbox'),'allow-scripts');
 assert.equal(await page.locator('iframe').evaluate(f=>f.contentDocument===null),true);
 assert.ok(await frame.locator('[data-wp-scene]').count()>0);
 await frame.locator('[data-wp-scene]').first().click();await frame.locator('#exercise').waitFor({state:'visible'});await frame.locator('#exercise-back').click();await frame.locator('#scenario-hub').waitFor({state:'visible'});
 assert.deepEqual(unexpected,[]);await ctx.close();console.log('PASS actual compiled education browser, forced alias, CSP, sandbox and locked scenario navigation (synthetic Auth issuer, real PostgREST authorization)');
 }finally{await browser.close();global.fetch=raw;}
})().catch(e=>{console.error(e);process.exitCode=1});
