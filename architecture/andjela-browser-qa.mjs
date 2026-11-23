import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const out=resolve('artifacts/andjela-qa');
await mkdir(out,{recursive:true});
const states=[['attentive','0% 0%'],['concerned','50% 0%'],['skeptical','100% 0%'],['surprised','50% 0%'],['relieved','0% 0%'],['reflecting','100% 0%']];
let failures=0;
const check=(name,pass,details={})=>{
 console.log(JSON.stringify({check:name,result:pass?'PASS':'FAIL',...details}));
 if(!pass)failures++;
};
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
async function snap(page){
 return page.evaluate(()=>{
  const p=document.querySelector('#exercise-portrait'),s=p?.querySelector('.portrait-stage');
  const shots=[...(s?.querySelectorAll('.portrait-shot')||[])];
  const shot=shots.at(-1),frame=shot?.querySelector('.portrait-frame');
  const r=shot?.getBoundingClientRect(),style=frame?getComputedStyle(frame):null;
  const visibleLayers=shots.filter(x=>{
   const c=getComputedStyle(x),b=x.getBoundingClientRect();
   return c.display!=='none'&&c.visibility!=='hidden'&&Number(c.opacity)>0&&b.width>0&&b.height>0;
  }).length;
  return {speaker:p?.dataset.speaker,pose:shot?.dataset.pose,emotion:shot?.dataset.emotion,
    visible:!!r&&r.width>0&&r.height>0,position:style?.backgroundPosition,size:style?.backgroundSize,
    hasImage:!!style&&style.backgroundImage!=='none',layers:shots.length,visibleLayers};
 });
}
try{
 for(const [version,file] of [['original','kringle/index.html'],['isolated','kringle-andjela-test/index.html']]){
  const page=await browser.newPage({viewport:{width:1280,height:850},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const url=pathToFileURL(resolve(file));url.searchParams.set('pregled','andjela');url.searchParams.set('andjela-test','1');
  await page.goto(url.toString(),{waitUntil:'load',timeout:45000});
  await page.waitForFunction(()=>document.querySelector('#exercise-portrait')?.dataset.speaker==='andjela',null,{timeout:15000});
  const patch=await page.evaluate(()=>!!document.querySelector('#aurea-andjela-no-hologram-test'));
  check(version+' patch confined',patch===(version==='isolated'));
  let initial=await snap(page);
  check(version+' real Andjela scene renders',initial.speaker==='andjela'&&initial.visible&&initial.hasImage,{initial});
  await page.locator('#exercise-portrait').screenshot({path:resolve(out,version+'-initial.png')});
  if(version==='isolated'){
   let hashes=[];
   for(const [emotion,pos] of states){
    await page.getByRole('button',{name:/^(Proveri Anđeline izraze|Anđela:)/}).click();
    await page.waitForFunction(expected=>document.querySelector('#exercise-portrait .portrait-shot:last-child')?.dataset.emotion===expected,emotion,{timeout:10000});
    const state=await snap(page);
    const bytes=await page.locator('#exercise-portrait').screenshot({path:resolve(out,'isolated-'+emotion+'.png'),animations:'disabled'});
    hashes.push(createHash('sha256').update(bytes).digest('hex'));
    check('isolated '+emotion+' truly displays mapped face',state.speaker==='andjela'&&state.visible&&state.hasImage&&state.position===pos&&state.size==='300% 100%',{state});
   }
   check('six labels resolve to exactly three genuine photographic faces',new Set(hashes).size===3,{differentFaces:new Set(hashes).size});
  }
  const cleanUrl=pathToFileURL(resolve(file));cleanUrl.searchParams.set('pregled','andjela');
  await page.goto(cleanUrl.toString(),{waitUntil:'load'});
  await page.waitForFunction(()=>document.querySelector('#exercise-portrait')?.dataset.speaker==='andjela');
  for (const [step,pose] of [['first','speaking'],['second','reflecting']]){
   const choice=page.locator('#exercise-options .exercise-choice').first();
   await choice.waitFor({timeout:10000});
   await choice.click();
   await page.waitForFunction(expected=>document.querySelector('#exercise-portrait .portrait-shot:last-child')?.dataset.pose===expected,pose,{timeout:10000});
   const during=await snap(page);
   if(version==='isolated')check('isolated no double face during '+step+' transition',during.visibleLayers===1,{during});
   await page.waitForTimeout(1250);
   const after=await snap(page);
   check(version+' real dialogue '+pose,after.pose===pose&&after.visible&&after.hasImage,{after});
   await page.locator('#exercise-portrait').screenshot({path:resolve(out,version+'-'+step+'-'+pose+'.png')});
  }
  if(version==='isolated'){
   const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
   mobile.on('pageerror',e=>errors.push(e.message));
   await mobile.goto(cleanUrl.toString(),{waitUntil:'load'});
   await mobile.waitForFunction(()=>document.querySelector('#exercise-portrait')?.dataset.speaker==='andjela');
   const m=await snap(mobile);
   check('isolated mobile portrait',m.visible&&m.hasImage&&m.size==='300% 100%',{mobile:m});
   await mobile.screenshot({path:resolve(out,'isolated-mobile.png'),fullPage:false});
   await mobile.close();
  }
  check(version+' browser console',errors.length===0,{errors});
  await page.close();
 }
}finally{await browser.close();}
console.log(failures?'FAIL '+failures+' checks':'PASS: original preserved, isolated Anđela mapping and dialogue verified');
if(failures)process.exitCode=1;
