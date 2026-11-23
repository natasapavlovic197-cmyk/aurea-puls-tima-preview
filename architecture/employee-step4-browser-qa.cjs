'use strict';
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {anchors,rotation,domains,weeklyItems}=require('./psychometric-item-bank.cjs');
const file=path.resolve(__dirname,process.env.AUREA_EMPLOYEE_FILE||'employee-six-question-preview.html');
const out=path.resolve(__dirname,'../artifacts/employee-step4');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 assert.equal(domains.length,10);
 const four=['2026-11-23','2026-11-30','2026-12-07','2026-12-14'];
 assert.equal(new Set(four.flatMap(w=>weeklyItems(w).map(q=>q.domain))).size,10);
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const report=[];
 try {
  for(const width of [390,1280]){
   const page=await browser.newPage({viewport:{width,height:844}});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('file://'+file);
   await page.locator('#employee .question').waitFor();
   assert.match(await page.locator('h1').innerText(),/nedeljni puls/i);
   for(let week=1;week<=4;week++){
    await page.locator('#week').selectOption(String(week));
    const expected=weeklyItems(four[week-1]);
    for(let i=0;i<6;i++){
     assert.match(await page.locator('.statline').innerText(),new RegExp('Pitanje '+(i+1)+' od 6'));
     assert.equal(await page.locator('.question').innerText(),expected[i].text);
     assert.equal(await page.locator('input[name="answer"]').count(),6);
     await page.locator('input[name="answer"][value="4"]').check();
     assert.equal(await page.locator('input[name="answer"][value="4"]').isChecked(),true);
     if(i===1){await page.locator('#prev').click();assert.equal(await page.locator('input[name="answer"][value="4"]').isChecked(),true);await page.locator('#next').click();}
     await page.locator('#next').click();
    }
    assert.match(await page.locator('#employee').innerText(),/Završni osvrt/i);
    await page.locator('#optionalBack').click();
    assert.match(await page.locator('.statline').innerText(),/Pitanje 6 od 6/);
    await page.locator('#next').click();
    await page.locator('#optionalSkip').click();
    assert.match(await page.locator('#employee').innerText(),/Hvala na izdvojenom vremenu/);
    await page.locator('#again').click();
   }
   assert.deepEqual(errors,[]);
   await page.screenshot({path:path.join(out,'employee-'+width+'.png'),fullPage:true});
   report.push({width,weeks:4,questions:24,jsErrors:errors.length,status:'PASS'});
   await page.close();
  }
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
  console.log('PASS: 10 domains, 4 weeks, 48 question interactions, back navigation, optional skip, finale, restart, mobile and desktop');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
