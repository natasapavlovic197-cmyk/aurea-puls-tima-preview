'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {createStagingServer}=require('./staging-manager-server.cjs');
const {createEmployeeRuntimeHttp}=require('./employee-runtime-http.cjs');
const {createEmployeeGateway}=require('./employee-server-gateway.cjs');
const fs=require('node:fs');
const original=fs.readFileSync('architecture/employee-six-question-preview.html','utf8'), built=fs.readFileSync('dist-staging-manager/employee.html','utf8');
const styles=s=>s.match(/<style\b[^>]*>[\s\S]*?<\/style>/g);
assert.deepEqual(styles(built),styles(original));
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
 for(const width of [390,1280]){
 const questions=['A','B','C','D','E','F'].map((code,i)=>({code,wording:'Test pitanje '+(i+1),position:i+1}));
 let redeemed=false,attempts=0;
 const employeeHandler=createEmployeeRuntimeHttp(createEmployeeGateway({rateLimit:async()=>true,adapter:{invitation:async hash=>{assert.match(hash,/^[a-f0-9]{64}$/);return {status:redeemed?'unavailable':'ready',questions}},submit:async(hash,answers)=>{attempts++;if(attempts===1)return {status:'unavailable'};assert.equal(answers.length,6);assert.equal(answers[0].rating,2);assert.equal(answers[5].rating,6);redeemed=true;return {status:'submitted'}}}}));
 const server=createStagingServer({employeeHandler});
 try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const page=await browser.newPage({viewport:{width,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/employee#'+'a'.repeat(64));
 await page.getByText('Test pitanje 1',{exact:true}).waitFor();
 assert.equal(new URL(page.url()).hash,'');
 assert.equal(await page.getByRole('button',{name:'Dalje'}).isDisabled(),true);
 await page.locator('input[type=radio]').nth(1).check();
 await page.getByRole('button',{name:'Dalje'}).click();
 await page.getByRole('button',{name:'Nazad'}).click();
 assert.equal(await page.locator('input[type=radio]').nth(1).isChecked(),true);
 await page.getByRole('button',{name:'Dalje'}).click();
 for(let i=2;i<=6;i++){
 await page.getByText('Test pitanje '+i,{exact:true}).waitFor();
 await page.locator('input[type=radio]').nth(i===6?5:3).check();
 if(i<6)await page.getByRole('button',{name:'Dalje'}).click();
 }
 await page.getByRole('button',{name:'Pošaljite odgovore'}).click();
 await page.getByText('Predaja nije potvrđena.',{exact:false}).waitFor();
 assert.equal(await page.getByText('Vaši odgovori su primljeni.',{exact:false}).count(),0);
 await page.getByRole('button',{name:'Pošaljite odgovore'}).click();
 await page.getByText('Vaši odgovori su primljeni.',{exact:false}).waitFor();
 assert.equal(attempts,2);
 assert.equal(await page.locator('#week, #optionalComment, #again').count(),0);
 assert.equal(await page.locator('.aurea-finale').count(),1);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 const replayContext=await browser.newContext({viewport:{width,height:900}});
 const replay=await replayContext.newPage();
 replay.on('pageerror',e=>errors.push(e.message));
 const denied= replay.waitForResponse(r=>r.url().endsWith('/api/employee/invitation')&&r.request().method()==='POST');
 await replay.goto(base+'/employee#'+'a'.repeat(64));
 assert.equal((await denied).status(),404);
 await replay.getByText('Poziv nije dostupan ili je već iskorišćen.').waitFor();
 await replayContext.close();
 assert.deepEqual(errors,[]);await page.close();
 }finally{await new Promise(r=>server.close(r));}
 }
 console.log('PASS: locked CSS, restricted gateway HTTP, six questions, NA, back, retry, replay and responsive premium finale');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
