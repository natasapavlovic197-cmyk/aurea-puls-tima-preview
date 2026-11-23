import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const dir=resolve('artifacts/andjela-qa');
await mkdir(dir,{recursive:true});
const emotions=['attentive','concerned','skeptical','surprised','relieved','reflecting'];
const expectedPose=['listening','speaking','reflecting','speaking','listening','reflecting'];
let failures=0;
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const results=[];
try {
 for(const [version,path] of [['original','kringle/index.html'],['isolated','kringle-andjela-test/index.html']]){
  const page=await browser.newPage({viewport:{width:1280,height:850},deviceScaleFactor:1,reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const nameResults=[];
  await page.goto('file://'+resolve(path)+'?pregled=andjela&andjela-test=1',{waitUntil:'load',timeout:45000});
  await page.waitForFunction(()=>document.getElementById('exercise-portrait')?.dataset.speaker==='andjela',null,{timeout:20000});
  const btn=page.getByRole('button',{name:/Proveri Anđeline izraze|Anđela:/});
  await btn.waitFor({timeout:10000});
  const initial=await page.evaluate(()=>{
   const p=document.querySelector('#exercise-portrait'),s=p?.querySelector('.portrait-shot:last-child'),f=s?.querySelector('.portrait-frame');
   return {speaker:p?.dataset.speaker,pose:s?.dataset.pose,background:f?getComputedStyle(f).backgroundPosition:null,visible:!!f&&p.getBoundingClientRect().width>0};
  });
  for(let i=0;i<emotions.length;i++){
   await btn.click();
   await page.waitForTimeout(180);
   const info=await page.evaluate(()=>{
    const p=document.querySelector('#exercise-portrait'),s=p?.querySelector('.portrait-stage .portrait-shot:last-child'),f=s?.querySelector('.portrait-frame');
    const css=f?getComputedStyle(f):null;
    return {speaker:p?.dataset.speaker,emotion:s?.dataset.emotion,pose:s?.dataset.pose,layers:p?.querySelectorAll('.portrait-stage .portrait-shot').length,
      position:css?.backgroundPosition,size:css?.backgroundSize,image:css?.backgroundImage!=='none',
      visible:!!s&&s.getBoundingClientRect().width>0&&s.getBoundingClientRect().height>0};
   });
   const bytes=await page.locator('#exercise-portrait').screenshot({path:resolve(dir,version+'-'+String(i+1).padStart(2,'0')+'-'+emotions[i]+'.png'),animations:'disabled'});
   const hash=createHash('sha256').update(bytes).digest('hex');
   const ok=info.speaker==='andjela'&&info.emotion===emotions[i]&&info.pose===expectedPose[i]&&info.visible&&info.image&&info.layers===1&&info.size==='300% 100%';
   if(!ok)failures++;
   nameResults.push({expected:emotions[i],expectedPose:expectedPose[i],pass:ok,pixelsHash:hash.slice(0,14),...info});
  }
  const distinctPixels=new Set(nameResults.map(x=>x.pixelsHash)).size;
  const distinctPositions=new Set(nameResults.map(x=>x.position)).size;
  // There are THREE approved photographed expressions. Six names must select them correctly.
  if(distinctPixels<3||distinctPositions<3)failures++;
  await page.goto('file://'+resolve(path)+'?pregled=andjela',{waitUntil:'load',timeout:45000});
  await page.waitForFunction(()=>document.getElementById('exercise-portrait')?.dataset.speaker==='andjela',null,{timeout:15000});
  let realScene={};
  const choice=page.locator('#exercise-options .exercise-choice').first();
  if(await choice.isVisible()){
    await page.emulateMedia({reducedMotion:'no-preference'});
    await choice.click();await page.waitForFunction(()=>{const s=document.querySelector('#exercise-portrait .portrait-stage .portrait-shot:last-child');return !!s&&s.dataset.pose!=='listening';},null,{timeout:12000});await page.waitForTimeout(150);
    realScene=await page.evaluate(()=>{
     const p=document.querySelector('#exercise-portrait'),ss=[...p.querySelectorAll('.portrait-stage .portrait-shot')];
     return {layers:ss.length,pose:ss.at(-1)?.dataset.pose,visible:!!ss.at(-1)&&ss.at(-1).getBoundingClientRect().width>0};
    });
    await page.locator('#exercise-portrait').screenshot({path:resolve(dir,version+'-dialogue.png'),animations:'allow'});
    if(realScene.layers!==1||realScene.pose==='listening')failures++;
  }else {realScene={error:'No visible dialogue choice'};failures++}
  if(errors.length)failures++;
  const summary={version,initial,distinctPixels,distinctPositions,realScene,errors,expressions:nameResults};
  results.push(summary);console.log(JSON.stringify(summary));
  await page.close();
 }
}finally{await browser.close()}
if(failures)throw new Error('Anđela QA: '+failures+' FAILED checks; see artifacts and JSON output. Six labels do NOT imply six photographic assets.');
console.log('PASS: 6 named states mapped to three distinct original photographs, exactly one visible portrait layer, real dialogue interactive, no browser JS errors. Aesthetic judgement still needs human screenshot review.');
