import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const out=resolve('artifacts/andjela-final-qa');
await mkdir(out,{recursive:true});
const names=['attentive','concerned','skeptical','surprised','relieved','reflecting'];
const expectedPoses=['listening','speaking','reflecting','speaking','listening','reflecting'];
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
let failures=0;
try{
 for(const [label,file] of [['original','kringle/index.html'],['isolated','kringle-andjela-test/index.html']]){
  const page=await browser.newPage({viewport:{width:1280,height:850},deviceScaleFactor:1,reducedMotion:'no-preference'});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  try{
   const url=pathToFileURL(resolve(file));url.searchParams.set('pregled','andjela');url.searchParams.set('andjela-test','1');
   await page.goto(url.toString(),{waitUntil:'load',timeout:45000});
   await page.waitForFunction(()=>{let p=document.getElementById('exercise-portrait');return p?.dataset.speaker==='andjela'&&!!p.querySelector('.portrait-stage .portrait-shot')},{},{timeout:16000});
   const state=()=>page.evaluate(()=>{
    const p=document.getElementById('exercise-portrait');
    const shots=[...p.querySelectorAll('.portrait-stage .portrait-shot')];
    const shot=shots.at(-1), frame=shot?.querySelector('.portrait-frame');
    const css=frame?getComputedStyle(frame):null;
    const rect=p.getBoundingClientRect();
    return {width:rect.width,height:rect.height,visible:rect.width>100&&rect.height>100,pose:shot?.dataset.pose||null,emotion:shot?.dataset.emotion||null,speaker:p.dataset.speaker,layers:shots.length,
      backgroundPosition:css?.backgroundPosition||null,backgroundSize:css?.backgroundSize||null,hasImage:!!css?.backgroundImage&&css.backgroundImage!=='none'};
   });
   const btn=page.getByRole('button',{name:/^(Proveri Anđeline izraze|Anđela:)/});
   await btn.waitFor({timeout:15000});
   const items=[];
   for(let k=0;k<names.length;k++){
    await btn.click();
    await page.waitForTimeout(220);
    const v=await state();
    const shot=await page.locator('#exercise-portrait').screenshot({path:resolve(out,label+'-'+names[k]+'.png'),animations:'disabled'});
    items.push({expected:names[k],expectedPose:expectedPoses[k],...v,sha256:createHash('sha256').update(shot).digest('hex').slice(0,18)});
   }
   const distinctPositions=new Set(items.map(x=>x.backgroundPosition)).size;
   const distinctPixels=new Set(items.map(x=>x.sha256)).size;
   console.log(JSON.stringify({label,phase:'six-state-control',items,distinctPositions,distinctPixels,errors},null,2));
   if(label==='isolated'){
     const ok=items.every((x,i)=>x.visible&&x.hasImage&&x.speaker==='andjela'&&x.emotion===names[i]&&x.pose===expectedPoses[i]&&x.layers===1);
     const framesDistinct=distinctPositions>=3&&distinctPixels>=3;
     if(!ok||!framesDistinct){console.error('FAIL isolated six-state mapping or real sprite image change');failures++;}
     else console.log('PASS: six semantic test states map to three distinct real face frames; no overlay');
   } else console.log('DIAGNOSTIC: original control changes only emotion labels; this is not a facial-motion PASS');
   // Real conversational branch must change listening -> speaking without overlapping portraits.
   const real=pathToFileURL(resolve(file));real.searchParams.set('pregled','andjela');
   await page.goto(real.toString(),{waitUntil:'load',timeout:45000});
   await page.waitForFunction(()=>document.getElementById('exercise-portrait')?.dataset.speaker==='andjela',null,{timeout:15000});
   const start=await state();
   if(label==='isolated'){
     const ratio=start.width/start.height;
     console.log(JSON.stringify({label,phase:'initial-proportions',width:start.width,height:start.height,ratio}));
     if(Math.abs(ratio-0.8)>0.015){console.error('FAIL: opening Anđela stretched by grid; expected 4:5');failures++;}
     else console.log('PASS: opening Anđela photo retains true 4:5 aspect ratio');
   }
   await page.locator('#exercise-options .exercise-choice').first().click({timeout:12000});
   await page.waitForFunction(()=>document.querySelector('#exercise-portrait .portrait-stage .portrait-shot:last-child')?.dataset.pose==='speaking',null,{timeout:12000});
   const after=await state();
   if(label==='isolated'&&Math.abs(after.width/after.height-0.8)>0.015){console.error('FAIL: Anđela changes proportions during dialogue');failures++;}
   await page.locator('#exercise-portrait').screenshot({path:resolve(out,label+'-real-dialogue.png'),animations:'allow'});
   console.log(JSON.stringify({label,phase:'real-dialogue',start,after,errors}));
   if(label==='isolated'&&(!start.visible||!after.visible||start.pose!=='listening'||after.pose!=='speaking'||after.layers!==1||errors.length)){console.error('FAIL isolated real dialogue');failures++;}
   else if(label==='isolated')console.log('PASS: Anđela conversational sprite changes with one layer; no JS errors');
  }catch(e){console.error('FAIL '+label+': '+(e.stack||e));failures++;}
  finally{await page.close();}
 }
}finally{await browser.close();}
if(failures){console.error('FAIL: '+failures+' assertions');process.exitCode=1;}
else console.log('PASS: isolated Anđela machine QA. Six labels = three real photographs; human aesthetic review still required.');
