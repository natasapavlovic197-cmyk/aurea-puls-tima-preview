const { chromium } = require('playwright');
const { pathToFileURL } = require('url');
const path = require('path');
const fs = require('fs');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 fs.mkdirSync('test-artifacts',{recursive:true});
 const assert=async(ok,msg)=>{if(!ok)throw Error(msg);console.log('PASS '+msg)};
 try{
  await page.goto(pathToFileURL(path.resolve('rukovodilac/index.html')).href);
  await assert(await page.locator('.aurea-sim').count()===1,'initial scenario');
  for(let i=0;i<3;i++){
   await assert((await page.locator('.aurea-sim-top').innerText()).includes((i+1)+' / 3'),'scene '+(i+1)+' visible');
   await page.locator('[data-choice="0"]').click();
   await assert(await page.locator('.aurea-sim-feedback').isVisible(),'feedback '+(i+1));
   if(i===1){
    await page.locator('#aureaSimBack').click();
    await assert((await page.locator('.aurea-sim-top').innerText()).includes('1 / 3'),'back to first scene');
    await assert(await page.locator('[data-choice="0"]').getAttribute('aria-pressed')==='true','previous choice retained');
    await page.locator('[data-choice="1"]').click();
    await page.locator('#aureaSimNext').click();
    await assert((await page.locator('.aurea-sim-top').innerText()).includes('2 / 3'),'forward after changed choice');
    await assert(await page.locator('[data-choice="0"]').getAttribute('aria-pressed')==='true','second scene choice retained');
   }
   await page.locator('#aureaSimNext').click();
  }
  await assert(await page.locator('.aurea-decision-recap').isVisible(),'decision recap');
  await page.screenshot({path:'test-artifacts/manager-overview-mobile.png',fullPage:true});
  await assert(await page.locator('.metric').count()===5,'five aggregate metrics');
  await page.locator('#v35guidance').click();
  await assert(await page.locator('#nextManager').count()===1,'one next button');
  await assert(await page.locator('#v35overview').count()===0,'no duplicate overview');
  await page.locator('#nextManager').click();
  await assert(await page.locator('#observation').isVisible(),'observation step');
  await page.locator('#observation').selectOption('Prekidi rada');
  await page.locator('#nextManager').click();
  await assert(await page.locator('#actionText').isVisible(),'activity step');
  await page.locator('#backManager').click();
  await assert(await page.locator('#observation').inputValue()==='Prekidi rada','observation preserved on back');
  await page.locator('#nextManager').click();
  await page.locator('#actionText').fill('Proveriti raspodelu zadataka na sastanku');
  await page.locator('#due').fill('2026-12-10');
  await page.locator('#saveAction').click();
  await assert(await page.locator('.aurea-finale').isVisible(),'completion');
  await page.screenshot({path:'test-artifacts/manager-completion-mobile.png',fullPage:true});
  await assert((await page.locator('#aureaFinalObservation').innerText()).includes('prekida'),'observation persisted');
  await page.locator('#v35finishEdit').click();
  await assert((await page.locator('#actionText').inputValue()).includes('Proveriti raspodelu'),'edit preserves activity');
  await page.locator('#v35activities').click();
  await assert(await page.locator('#v35status').isVisible(),'activity status control');
  await page.locator('#v35status').click();
  await assert((await page.locator('#manager').innerText()).includes('Završeno'),'status updated');
  await page.goto(pathToFileURL(path.resolve('index.html')).href);
  await assert(await page.locator('a[href="/zaposleni/"]').count()===1,'landing links to employee demo');
  await assert(await page.locator('a[href="/rukovodilac/"]').count()===1,'landing links to manager demo');
  await assert(await page.locator('a[href="/portal/"]').count()===1,'landing links to secure portal');
  await page.goto(pathToFileURL(path.resolve('zaposleni/index.html')).href);
  await assert(await page.locator('#next').isDisabled(),'employee cannot continue unanswered');
  await page.screenshot({path:'test-artifacts/employee-mobile.png',fullPage:true});
  for(let i=0;i<4;i++){
   await page.locator('input[name="answer"][value="4"]').check();
   await assert(await page.locator('#next').isEnabled(),'employee answer '+(i+1)+' enables next');
   if(i===1){
    await page.locator('#prev').click();
    await assert(await page.locator('input[name="answer"][value="4"]').isChecked(),'employee previous answer retained');
    await page.locator('#next').click();
   }
   await page.locator('#next').click();
  }
  await assert(await page.locator('.aurea-finale').isVisible(),'employee completion');
  await page.locator('#again').click();
  await assert(await page.locator('#next').isDisabled(),'employee restart clears answers');
  await page.locator('#week').selectOption('2');
  await assert((await page.locator('#employee').innerText()).includes('Nedelja 2'),'employee week selector');
  await page.goto(pathToFileURL(path.resolve('odgovor/index.html')).href);
  await assert((await page.locator('#content').innerText()).includes('Potreban je pristupni link'),'real employee form rejects missing invitation');
  await assert(await page.locator('#content input').count()===0,'no survey without valid token');
  await page.goto(pathToFileURL(path.resolve('portal/index.html')).href);
  await assert(await page.locator('#private').isHidden(),'manager private panel hidden before login');
  await page.locator('#login').click();
  await assert((await page.locator('#status').innerText()).includes('Unesite adresu i lozinku'),'manager login validates missing credentials');
  await assert(await page.locator('#private').isHidden(),'private panel remains hidden after invalid login');
  await page.locator('#reset').click();
  await assert((await page.locator('#status').innerText()).includes('Unesite svoju e-adresu'),'password reset validates email');
  await assert(errors.length===0,'no JavaScript page errors: '+errors.join(' | '));
  console.log('ALL MOBILE SMOKE TESTS PASSED');
 }catch(e){console.error('FAILED',e.stack);console.error('BROWSER ERRORS',errors);process.exitCode=1}
 finally{await browser.close()}
})();