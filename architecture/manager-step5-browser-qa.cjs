'use strict';
const {chromium}=require('playwright');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [390,1280]){
   const page=await browser.newPage({viewport:{width,height:850}});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('file://'+path.resolve(__dirname,'../rukovodilac/index.html'));
   await page.evaluate(()=>v35Navigate('overview'));
   await page.locator('#aureaTenDomainCatalogue').waitFor();
   assert.equal(await page.locator('#aureaTenDomainCatalogue .metric').count(),10);
   assert.equal(await page.locator('#aureaTenDomainCatalogue .metric .fine').count(),10);
   assert.match(await page.locator('#aureaTenDomainCatalogue').innerText(),/6 pitanja nedeljno/);
   assert.equal(await page.locator('#v35home').getAttribute('aria-current'),'page');
   await page.locator('#v35activities').click();
   assert.match(await page.locator('#manager').innerText(),/Moje aktivnosti/);
   await page.locator('#v35home').click();
   assert.equal(await page.locator('#aureaTenDomainCatalogue .metric').count(),10);
   assert.deepEqual(errors,[]);
   await page.close();
  }
  console.log('PASS: Manager ten-domain overview, navigation and responsive viewport');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
