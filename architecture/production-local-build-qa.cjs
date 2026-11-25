'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),http=require('node:http'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const root=path.resolve('dist-production-manager');
const cfg=require('./postgrest-runtime/production-public-config.cjs').createProductionPublicConfig({environment:'production'});
const gate=require('./postgrest-runtime/production-runtime-gate.cjs');
const check=(name)=>console.log('PASS '+name);
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
(async()=>{
 const files=walk(root);
 for(const required of ['index.html','employee.html','signature-education.html','production-config.js','manager-login.bundle.js','employee.bundle.js','assets/natasa-guide.webp','signature-motion.js','signature22-manager.css','signature22-employee.css','manager-login.css'])assert.ok(fs.statSync(path.join(root,required)).size>0,required);
 for(const f of files){assert.ok(!/\.env|\.sql$|\.cjs$|\.ts$|\.map$|\.git\//.test(f),f);if(/\.(js|html|css)$/.test(f)){const s=fs.readFileSync(f,'utf8');assert.doesNotMatch(s,/sb_secret_[A-Za-z0-9_-]{10,}|SUPABASE_ACCESS_TOKEN|AUREA_DELIVERY_AUTH_PASSWORD|AUREA_INVITATION_HMAC_SECRET|SUPABASE_SERVICE_ROLE_KEY/,f);}}
 assert.ok(!fs.existsSync(path.join(root,'staging-config.js')));
 for(const f of ['index.html','employee.html','signature-education.html'])assert.match(fs.readFileSync(path.join(root,f),'utf8'),/<meta name="referrer" content="no-referrer">/);
 const configFile=fs.readFileSync(path.join(root,'production-config.js'),'utf8');assert.ok(configFile.includes(cfg.url)&&configFile.includes(cfg.key)&&configFile.includes('"enabled":false'));
 check('compiled public files, production configuration, no server-secret markers, locked templates and referrer policies');
 let network=0;globalThis.fetch=async()=>{network++;throw Error('forbidden network')};
 assert.equal(gate.activated,false);assert.throws(()=>gate.assertActive(),/not approved/);
 assert.throws(()=>require('./postgrest-runtime/production-browser-transport.cjs').createPostgrestTransport({...cfg,fetchImpl:globalThis.fetch}),/not approved/);
 const {scheduleWeekly}=require('./postgrest-runtime/production-weekly-scheduler.cjs');assert.deepEqual(await scheduleWeekly(),{status:'disabled'});await assert.rejects(()=>scheduleWeekly({...cfg,enabled:true,fetchImpl:globalThis.fetch}),/not approved/);
 assert.throws(()=>require('./postgrest-runtime/production-delivery-runtime.cjs').preparePostgrestDeliveryRuntime(),/not approved/);
 let adminHandler;globalThis.Deno={serve:f=>{adminHandler=f},env:{get(){throw Error('unexpected credential read')}}};
 require('./commercial/billing-admin-edge-production.ts');
 for(const method of ['POST','OPTIONS','GET'])assert.equal((await adminHandler(new Request('https://local.invalid',{method}))).status,503);
 assert.equal(network,0);check('delivery, scheduler and admin handler deny before credentials or network');
 const admin=fs.readFileSync(path.join(__dirname,'commercial/billing-admin-production-portal.html'));
 const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.webp':'image/webp','.svg':'image/svg+xml','.png':'image/png'};
 const server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://127.0.0.1');if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}if(u.pathname==='/__qa_admin'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}).end(admin);return;}const file=path.resolve(root,'.'+(u.pathname==='/'?'/index.html':decodeURIComponent(u.pathname)));if(!file.startsWith(root+path.sep)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 let browser;try{
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({serviceWorkers:'block'});
 const bad=[],errors=[],missing=[];let tamper=false;
 await context.route('**/*',async route=>{const req=route.request();if(!req.url().startsWith(origin+'/')||!['GET','HEAD'].includes(req.method())||req.url().startsWith(origin+'/api/')){bad.push(req.method()+' '+new URL(req.url()).origin);await route.abort();return;}if(tamper&&req.url()===origin+'/production-config.js'){await route.fulfill({contentType:'application/javascript',body:'globalThis.AUREA_PRODUCTION_CONFIG={environment:"production",enabled:true};'});return;}await route.continue();});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&r.url().startsWith(origin+'/'))missing.push(new URL(r.url()).pathname);});
 for(const width of [1280,390]){await page.setViewportSize({width,height:844});
 await page.goto(origin+'/');await page.locator('#manager-login [role=status]').filter({hasText:'Produkcijsko okruženje još nije aktivirano.'}).waitFor();assert.equal(await page.locator('#manager-login input').count(),0);
 await page.goto(origin+'/employee.html#'+'a'.repeat(64));await page.locator('#employee [role=status]').filter({hasText:'Produkcijsko okruženje još nije aktivirano.'}).waitFor();assert.equal(new URL(page.url()).hash,'');
 }
 tamper=true;await page.goto(origin+'/');await page.locator('#manager-login [role=status]').filter({hasText:'Produkcijsko okruženje još nije aktivirano.'}).waitFor();tamper=false;
 await page.goto(origin+'/__qa_admin');assert.equal(await page.locator('input:not([disabled]), select:not([disabled]), button:not([disabled])').count(),0);
 assert.deepEqual(bad,[]);assert.deepEqual(errors,[]);assert.deepEqual(missing.filter(x=>x!=='/favicon.ico'),[]);
 check('desktop/mobile manager and employee, synthetic fragment removed, tampered configuration rejected, disabled admin controls, zero nonlocal or API requests');
 await context.close();
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
 for(const f of files.sort()){console.log('FILE '+path.relative(root,f)+' '+fs.statSync(f).size+' '+crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'));}
 console.log('PASS isolated production build and localhost QA; activation disabled; no deployment');
})().catch(e=>{console.error(e);process.exitCode=1;});
