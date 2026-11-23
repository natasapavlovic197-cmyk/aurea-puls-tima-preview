const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
 for(const width of [390,1280]){
 const page=await browser.newPage({viewport:{width,height:850}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<main id="root" class="aurea-login"></main>');
 await page.addStyleTag({path:path.join(__dirname,'manager-login.css')});
 await page.addScriptTag({path:path.join(__dirname,'manager-login-view.js')});
 await page.evaluate(()=>{
 window.mountManagerLogin(document.getElementById('root'),{
 signIn:async(email,password)=>{if(password!=='test-only')throw Error('denied');return {signOut:async()=>{}};},
 openWorkspace:async(host)=>({companies:[{id:'test',name:'Test kompanija'}],select:async()=>{host.textContent='Grupni rezultati';},signOut:async()=>{host.replaceChildren();},dispose(){host.replaceChildren();}})
 });
 });
 await page.getByRole('textbox',{name:'Email adresa'}).fill('qa@example.invalid');
 await page.locator('input[type=password]').fill('wrong');
 await page.getByRole('button',{name:'Prijavite se'}).click();
 await page.getByText('Prijava nije uspela.').waitFor();
 assert.equal(await page.locator('input[type=password]').inputValue(),'');
 await page.locator('input[type=password]').fill('test-only');
 await page.getByRole('button',{name:'Prijavite se'}).click();
 await page.getByRole('button',{name:'Test kompanija'}).click();
 await page.getByText('Grupni rezultati').waitFor();
 await page.getByRole('button',{name:'Odjavite se'}).click();
 await page.getByRole('button',{name:'Prijavite se'}).waitFor();
 assert.equal(await page.getByText('Grupni rezultati').count(),0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);await page.close();
 }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
