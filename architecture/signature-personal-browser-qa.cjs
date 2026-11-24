'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),{webcrypto}=require('node:crypto'),esbuild=require('esbuild');
const {premiumEmployee}=require('./premium-employee-template.cjs');
const {weeklyItems}=require('./psychometric-item-bank.cjs');
const {append,seal}=require('./employee-personal-history.cjs');
(async()=>{
 const source=fs.readFileSync('architecture/employee-six-question-preview.html','utf8');
 const html=premiumEmployee(source);
 assert.deepEqual(html.match(/<style\b[^>]*>[\s\S]*?<\/style>/g),source.match(/<style\b[^>]*>[\s\S]*?<\/style>/g));
 const bundle=(await esbuild.build({entryPoints:['architecture/employee-staging-entry.cjs'],bundle:true,platform:'browser',format:'iife',write:false})).outputFiles[0].text;
 const questions=weeklyItems('2026-11-23').map((q,i)=>({code:q.code,wording:q.text,position:i+1}));
 const previous=['2026-10-26','2026-11-02','2026-11-09','2026-11-16'].reduce((a,d,i)=>append(a,weeklyItems(d).map(q=>({code:q.code,rating:i+1})),d),[]);
 const pass='synthetic-test-passphrase-2026',archive=await seal(previous,pass,webcrypto);
 fs.mkdirSync('artifacts/signature-personal',{recursive:true});
 const browser=await chromium.launch({headless:true});
 try{for(const width of [390,1280]){
 const page=await browser.newPage({viewport:{width,height:844},acceptDownloads:true});
 const errors=[],unexpected=[];let submitted=0;page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin!=='http://localhost:8123'){unexpected.push(u.origin);return route.abort()}
 if(u.pathname==='/employee.html')return route.fulfill({contentType:'text/html',body:html});
 if(u.pathname==='/staging-config.js')return route.fulfill({contentType:'text/javascript',body:''});
 if(u.pathname==='/employee.bundle.js')return route.fulfill({contentType:'text/javascript',body:bundle});
 if(u.pathname==='/api/employee/invitation')return route.fulfill({json:{status:'ready',questions}});
 if(u.pathname==='/api/employee/submit'){submitted++;assert.equal(route.request().postDataJSON().answers.length,6);return route.fulfill({json:{status:'submitted'}})}
 unexpected.push(u.pathname);return route.abort();
 });
 await page.goto('http://localhost:8123/employee.html#'+'a'.repeat(64));
 for(let i=0;i<6;i++){await page.locator('input[type=radio]').nth(i===5?5:3).check();await page.locator('#next').click()}
 await page.getByText('Vaši odgovori su primljeni.',{exact:false}).waitFor();
 await page.getByRole('button',{name:'Pogledajte svoj lični puls'}).click();
 const radar=page.getByRole('img',{name:/Radar pojedinačnih/});await radar.waitFor();
 assert.equal(await radar.locator('circle').count(),5);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:'artifacts/signature-personal/radar-'+width+'.png',fullPage:true,animations:'disabled'});
 await page.locator('#personal-settings summary').click();
 assert.equal(await page.locator('#personal-settings').getAttribute('open'),'');
 await page.locator('#personal-archive').setInputFiles({name:'synthetic.aurea',mimeType:'application/json',buffer:Buffer.from(archive)});
 await page.locator('#personal-pass').fill(pass);
 await page.locator('#personal-load').click();
 await page.getByText('Istorija je otvorena samo u ovoj stranici.').waitFor();
 await page.locator('#personal-item').selectOption('A_CLARITY');
 await page.getByRole('img',{name:'Lični trend odgovora od 1 do 5'}).waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.locator('#personal-trend').screenshot({path:'artifacts/signature-personal/trend-'+width+'.png',animations:'disabled'});
 await page.locator('#personal-pass').fill(pass);
 await page.locator('#personal-save').click();
 await page.getByText('Šifrovana datoteka je spremna.',{exact:false}).waitFor();
 const download=page.waitForEvent('download');await page.getByRole('link',{name:'Sačuvajte datoteku'}).click();assert.equal((await download).suggestedFilename(),'AUREA-licna-istorija.aurea');
 await page.locator('#personal-clear').click();assert.equal(await page.locator('#personal-trend').isVisible(),false);
 await page.locator('#personal-dismiss').click();assert.equal(await radar.count(),0);
 assert.equal(submitted,1);assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 await page.close();console.log('PASS synthetic browser flow, radar, encrypted history, trend, download, clear, no external requests: '+width);
 }}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
