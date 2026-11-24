'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const {createStagingServer}=require('./staging-manager-server.cjs');
const {SQL}=require('./postgres-durable-limiter.cjs');
const original=fs.readFileSync('rukovodilac/index.html','utf8'),built=fs.readFileSync('dist-staging-manager/index.html','utf8');
const styles=s=>s.match(/<style\b[^>]*>[\s\S]*?<\/style>/g);
assert.deepEqual(styles(built),styles(original));assert.ok(!built.includes('DEMO_N'));
const org='12345678-1234-1234-1234-123456789abc',foreign='abcdefab-1234-1234-1234-123456789abc',user='12345678-1234-1234-1234-123456789abd',actionId='12345678-1234-1234-1234-123456789abe';
const baseUrl='https://ublzmoroanhlcgpnxilw.supabase.co';
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const width of [390,1280]){
 let activities=[],fail=false,mode='normal';
 const rows=[{week_start:'2026-11-23',item_code:'A_WORKLOAD',item_version:1,domain:'workload',response_count:5,favorable_percent:40,closed:true},{week_start:'2026-11-30',item_code:'A_WORKLOAD',item_version:1,domain:'workload',response_count:5,favorable_percent:20,closed:true},{week_start:'2026-12-07',item_code:'A_WORKLOAD',item_version:2,domain:'workload',response_count:5,favorable_percent:80,closed:true}];
 const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json'}});
 const fetchImpl=async(url,opts)=>{if(opts.headers.authorization!=='Bearer qa-token')return json({},401);if(url.endsWith('/auth/v1/user'))return json({id:user});const p=JSON.parse(opts.body);if(p.p_organization_id!==org)return json({},403);if(url.endsWith('aurea_manager_publications_v2'))return json(mode==='empty'?[]:mode==='small'?[{...rows[0],response_count:4}]:rows);if(url.endsWith('aurea_manager_actions'))return json(activities);if(url.endsWith('aurea_manager_save_action')){if(fail)return json({},503);activities=[{id:actionId,description:p.p_description,due_on:p.p_due_on,status:p.p_status}];return json(actionId)}throw Error('Unexpected request')};
 const server=createStagingServer({env:{AUREA_SUPABASE_URL:baseUrl,AUREA_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_qa',AUREA_LIMITER_SECRET:'x'.repeat(64)},query:async(sql)=>{assert.equal(sql,SQL);return {rows:[{hits:1}]}},fetchImpl});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
 const base='http://127.0.0.1:'+server.address().port,page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/staging-config.js',r=>r.fulfill({contentType:'application/javascript',body:'globalThis.AUREA_STAGING_CONFIG='+JSON.stringify({url:baseUrl,key:'sb_publishable_qa',endpoint:'/api/manager-workspace'})}));
 await page.route(baseUrl+'/**',async r=>{const url=r.request().url();const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','content-type':'application/json'};if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers});if(url.includes('/auth/v1/token'))return r.fulfill({headers,body:JSON.stringify({access_token:'qa-token',refresh_token:'qa-refresh',expires_in:3600,token_type:'bearer',user:{id:user,aud:'authenticated'}})});if(url.includes('aurea_my_companies'))return r.fulfill({headers,body:JSON.stringify([{organization_id:org,organization_name:'QA kompanija',member_role:'manager'}])});if(url.includes('/auth/v1/logout'))return r.fulfill({status:204,headers});return r.fulfill({status:403,headers,body:'{}'})});
 await page.goto(base);await page.getByLabel('Email adresa').fill('qa@example.invalid');await page.getByLabel('Lozinka').fill('qa-password');await page.getByRole('button',{name:'Prijavite se'}).click();await page.getByRole('button',{name:'QA kompanija'}).click();
 await page.locator('#aureaExpandDomains').waitFor();assert.equal(await page.locator('.metric').count(),5);await page.locator('#aureaExpandDomains').click();assert.equal(await page.locator('.metric').count(),10);
 await page.locator('#itemVersion').selectOption('1');assert.equal(await page.locator('.chart circle').count(),2);assert.match(await page.locator('.statline').innerText(),/20%/);await page.locator('#itemVersion').selectOption('2');assert.equal(await page.locator('.chart circle').count(),1);assert.match(await page.locator('.statline').innerText(),/80%/);
 assert.equal((await page.request.get(base+'/api/manager-workspace?organization_id='+foreign,{headers:{authorization:'Bearer qa-token'}})).status(),403);
 assert.equal((await page.request.get(base+'/api/manager-workspace?organization_id='+org)).status(),403);
 await page.getByRole('button',{name:'Moje aktivnosti',exact:true}).click();await page.locator('#newAction').click();await page.locator('#nextManager').click();await page.locator('#nextManager').click();await page.locator('#actionText').fill('QA plan');await page.locator('#due').fill('2026-12-15');fail=true;await page.locator('#saveAction').click();await page.getByText(/Aktivnost nije potvrđena/).waitFor();fail=false;await page.locator('#saveAction').click();await page.getByText('Aktivnost je potvrđena na serveru.').waitFor();await page.locator('.v35nav [data-screen=activities]').click();await page.getByText('QA plan',{exact:true}).waitFor();await page.getByRole('button',{name:'Izmeni aktivnost'}).click();await page.locator('#actionStatus').selectOption('done');await page.locator('#saveAction').click();await page.getByText('Aktivnost je potvrđena na serveru.').waitFor();
 mode='empty';await page.getByRole('button',{name:'QA kompanija'}).click();await page.locator('#aureaExpandDomains').waitFor();assert.equal(await page.locator('.chart circle').count(),0);await page.getByText('Nema objavljenog merenja').waitFor();
 mode='small';await page.getByRole('button',{name:'QA kompanija'}).click();await page.getByText('Poslovni pregled trenutno nije dostupan.').waitFor();assert.equal(await page.locator('.metric').count(),0);
 await page.getByRole('button',{name:'Odjavite se'}).click();assert.equal(await page.locator('.metric').count(),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);await page.close();
 }finally{await new Promise(r=>server.close(r))}
 }
 console.log('PASS: locked manager CSS, 10 domains, versions, charts, privacy, empty, tenant denial, activities, logout, mobile/desktop');
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
