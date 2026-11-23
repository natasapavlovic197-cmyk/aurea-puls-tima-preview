'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
 for(const width of [390,1280]){
 const page=await browser.newPage({viewport:{width,height:850}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('file://'+path.resolve(__dirname,'../rukovodilac/index.html'));
 await page.evaluate(()=>v35Navigate('overview'));
 await page.locator('#v35analyze').click();
 await page.locator('#aureaAcceptRecommendation').click();
 assert.match(await page.locator('#actionText').inputValue(),/obim zadataka/);
 await page.locator('#actionText').fill('Proveriti raspodelu zadataka');
 await page.locator('#due').fill('2026-12-15');
 await page.locator('#saveAction').click();
 assert.match(await page.locator('#manager').innerText(),/Vaš plan za naredni period/);
 await page.locator('#v35finishActivities').click();
 assert.match(await page.locator('#manager').innerText(),/Proveriti raspodelu zadataka/);
 await page.locator('#v35status').click();
 assert.match(await page.locator('#manager').innerText(),/Završeno/);
 await page.locator('#v35edit').click();
 await page.locator('#actionText').fill('Proveriti prioritete');
 await page.locator('#saveAction').click();
 await page.locator('#v35finishActivities').click();
 assert.match(await page.locator('#manager').innerText(),/Proveriti prioritete/);
 assert.match(await page.locator('#manager').innerText(),/Završeno/);
 assert.deepEqual(errors,[]);
 await page.close();
 }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
