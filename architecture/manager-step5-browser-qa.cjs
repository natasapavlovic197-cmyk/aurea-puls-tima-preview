'use strict';
const {chromium}=require('playwright');
const path=require('node:path');
const assert=require('node:assert/strict');
const {weeklyItems,domains}=require('./psychometric-item-bank.cjs');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [390,1280]){
   const page=await browser.newPage({viewport:{width,height:850}});
   const errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route(/^https?:\/\//,r=>{external.push(r.request().url());return r.abort()});
   await page.goto('file://'+path.resolve(__dirname,'../rukovodilac/index.html'));
   await page.evaluate(()=>v35Navigate('overview'));
   assert.equal(await page.locator('[data-domain]').count(),5);
   await page.locator('#aureaExpandDomains').click();
   assert.equal(await page.locator('[data-domain]').count(),10);
   const expected=Array.from({length:12},(_,i)=>weeklyItems(new Date(Date.UTC(2026,10,23+7*i,12)).toISOString().slice(0,10)));
   const keys=await page.locator('[data-domain]').evaluateAll(xs=>xs.map(x=>x.dataset.domain));
   const seen=new Set(),covered=new Set();
   for(const key of keys){
    await page.locator('[data-domain="'+key+'"]').click();
    const code=await page.evaluate(k=>DOMAIN[k].code,key);covered.add(code);
    const options=await page.locator('#aureaItemSelect option').evaluateAll(xs=>xs.map(x=>({code:x.value,text:x.textContent})));
    for(const item of options){
     seen.add(item.code);
     await page.locator('#aureaItemSelect').selectOption(item.code);
     const weeks=expected.flatMap((items,i)=>items.some(q=>q.code===item.code)?[i+1]:[]);
     assert.equal(item.text,expected.flat().find(q=>q.code===item.code).text);
     const actual=await page.evaluate(k=>({points:available(k),delta:comparableDelta(k),cadence:itemCadence(itemForDomain[k])}),key);
     assert.deepEqual(actual.points.map(p=>p.w),weeks);
     assert.ok(actual.points.every(p=>p.v>=0&&p.v<=100));
     assert.equal(actual.cadence,item.code.startsWith('A_')?1:4);
     assert.equal(await page.locator('svg.chart circle').count(),weeks.length);
     assert.match(await page.locator('#manager').innerText(),/važećim odgovorima 1–5/);
     if(weeks.at(-1)<12)assert.match(await page.locator('#manager').innerText(),/ranije merenje/);
    }
   }
   assert.equal(seen.size,15);assert.deepEqual([...covered].sort(),[...domains].sort());
   await page.locator('#aureaExpandDomains').click();
   assert.equal(await page.locator('[data-domain]').count(),5);
   await page.locator('#v35activities').click();
   assert.match(await page.locator('#manager').innerText(),/Moje aktivnosti/);
   await page.locator('#v35home').click();
   assert.equal(await page.locator('[data-domain]').count(),5);
   assert.equal(await page.locator('#v35home').getAttribute('aria-current'),'page');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   await page.goto('file://'+path.resolve(__dirname,'../zaposleni/index.html'));
   for(let w=1;w<=12;w++){
    await page.locator('#week').selectOption(String(w));
    const actual=await page.evaluate(()=>SCHEDULE[week-1]);
    assert.deepEqual(actual,expected[w-1].map(q=>q.code));
    assert.equal(actual.length,6);
   }
   for(let i=0;i<6;i++){await page.locator('input[name="answer"][value="6"]').check();await page.locator('#next').click()}
   await page.locator('#optionalSkip').click();
   assert.match(await page.locator('#employee').innerText(),/Odgovori nisu poslati niti sačuvani/);
   await page.locator('#again').click();
   assert.equal(await page.locator('input[name="answer"]:checked').count(),0);
   assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
   await page.close();
  }
  console.log('PASS: 10 domains, 15 items, 12 weeks, graphs, employee consistency, navigation and offline privacy at mobile/desktop widths');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
