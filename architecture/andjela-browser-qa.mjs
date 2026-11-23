import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const out=resolve('artifacts/andjela-qa');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const [name,path] of [['original','kringle/index.html'],['isolated','kringle-andjela-test/index.html']]){
  const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('file://'+resolve(path),{waitUntil:'domcontentloaded',timeout:45000});
  await page.screenshot({path:resolve(out,name+'-initial.png'),fullPage:false,timeout:30000});
  const info=await page.evaluate(()=>{
   const node=document.querySelector('.portrait-andjela');
   const frame=node?.querySelector('.portrait-frame');
   const style=frame?getComputedStyle(frame):null;
   return {title:document.title,portraitPresent:!!node,portraitVisible:!!node&&node.getBoundingClientRect().width>0,framePresent:!!frame,backgroundSize:style?.backgroundSize||null,patchPresent:!!document.getElementById('aurea-andjela-no-hologram-test')};
  });
  console.log(JSON.stringify({name,...info,pageErrors:errors.slice(0,8)}));
  if(name==='original'&&info.patchPresent)throw Error('Original unexpectedly patched');
  if(name==='isolated'&&!info.patchPresent)throw Error('Isolated patch missing');
  // Inspect available entry controls without changing app state or approved design.
  const entry=await page.locator('button, a, [role="button"]').evaluateAll(nodes=>nodes.filter(n=>{const r=n.getBoundingClientRect();return r.width>0&&r.height>0}).slice(0,25).map(n=>({tag:n.tagName,text:(n.textContent||'').trim().slice(0,90),href:n.getAttribute('href')})));
  console.log(JSON.stringify({name,visibleEntryControls:entry}));
  // Enter the actual demonstration and record the first interactive state.
  await page.getByRole('button',{name:'Pokrenite demonstraciju'}).click({timeout:10000});
  await page.waitForTimeout(900);
  const afterEntry=await page.evaluate(()=>{
    const node=document.querySelector('.portrait-andjela');
    const frame=node?.querySelector('.portrait-frame');
    const r=node?.getBoundingClientRect();
    const style=frame?getComputedStyle(frame):null;
    return {portraitPresent:!!node,portraitVisible:!!r&&r.width>0&&r.height>0,framePresent:!!frame,backgroundPosition:style?.backgroundPosition||null,backgroundSize:style?.backgroundSize||null,visibleButtons:[...document.querySelectorAll('button')].filter(n=>{const r=n.getBoundingClientRect();return r.width>0&&r.height>0}).slice(0,20).map(n=>(n.textContent||'').trim().slice(0,80))};
  });
  console.log(JSON.stringify({name,afterEntry,pageErrors:errors.slice(0,8)}));
  await page.screenshot({path:resolve(out,name+'-after-entry.png'),fullPage:false,timeout:30000});
  if(errors.length)throw Error(name+' has browser JavaScript errors after entering demo: '+errors.length);
  // The character may be introduced later in the scenario; don't claim facial
  // animation is validated just because the demonstration entry works.
  await page.close();
 }
}finally{await browser.close();}
console.log('PASS: both versions render in Chromium and isolated override is confined to test page; interactive facial-motion review remains necessary');
