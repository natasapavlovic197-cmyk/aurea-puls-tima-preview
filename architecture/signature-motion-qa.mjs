import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
const source=await readFile('kringle/index.html','utf8');
const hash=s=>createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0').update(s).digest('hex');
assert.equal(hash(source),'86303e79bd6705f23c24f8d3d2a8f4d8b0f23943');
const anchor='if (!current || immediate || reducedMotion.matches || !shot.animate) {';
assert.equal(source.split(anchor).length,2);
const candidate=source.replace(anchor,"if (speaker === 'andjela' || current?.classList.contains('portrait-andjela') || !current || immediate || reducedMotion.matches || !shot.animate) {\n    if (speaker === 'andjela' || current?.classList.contains('portrait-andjela')) stage.querySelectorAll('.portrait-shot').forEach(old => old.getAnimations().forEach(a=>a.cancel()));");
const css='<style id="signature-andjela-motion">#exercise-portrait .portrait-shot.portrait-andjela > .portrait-frame{opacity:1!important;animation:none!important;transition:none!important}#exercise-portrait .portrait-shot.portrait-andjela .portrait-face{display:none!important}</style>';
const patched=candidate.replace('</head>',css+'</head>');
const out=resolve('artifacts/signature-motion');
await mkdir(out,{recursive:true});
await writeFile(resolve(out,'candidate.html'),patched);
const browser=await chromium.launch({headless:true});
const report=[];
try{
 for(const width of [390,1280]){
 for(const [variant,file] of [['original',resolve('kringle/index.html')],['candidate',resolve(out,'candidate.html')]]){
 const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.request().url().startsWith('file:')||r.request().url().startsWith('data:')?r.continue():r.abort());
 await page.goto('file://'+file,{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Pokrenite demonstraciju'}).click();
 const names=await page.evaluate(()=>Object.keys(exerciseSpeakers));
 assert.deepEqual([...names].sort(),['andjela','filip','luka','maja','marko','sara'].sort());
 await page.evaluate(()=>openExercise());
 for(const name of names){
 await page.evaluate(name=>{setExerciseSpeaker(name);setPortraitPose('listening',true)},name);
 const figure=page.locator('#exercise-portrait');
 await figure.waitFor({state:'visible'});
 for(const pose of ['listening','speaking','reflecting']){
 await page.evaluate(pose=>setPortraitPose(pose),pose);
 const initial=await figure.evaluate(el=>({layers:el.querySelectorAll('.portrait-shot').length,pose:el.dataset.pose}));
 if(variant==='candidate'&&name==='andjela')assert.equal(initial.layers,1);
 if(pose!=='listening')await figure.screenshot({path:resolve(out,variant+'-'+width+'-'+name+'-'+pose+'-transition.png')});
 await page.waitForFunction(()=>document.querySelectorAll('#exercise-portrait .portrait-shot').length===1);
 const final=await figure.evaluate(el=>{const shot=el.querySelector('.portrait-shot'),frame=shot.querySelector(':scope > .portrait-frame'),s=getComputedStyle(frame);return {pose:shot.dataset.pose,size:s.backgroundSize,position:s.backgroundPosition,opacity:s.opacity,hasImage:s.backgroundImage!=='none'}});
 assert.equal(final.pose,pose);assert.ok(final.hasImage);
 if(variant==='candidate'&&name==='andjela'){assert.equal(final.size,'300% 100%');assert.equal(final.opacity,'1')}
 await figure.screenshot({path:resolve(out,variant+'-'+width+'-'+name+'-'+pose+'.png')});
 report.push({width,variant,name,pose,initial,final});
 }
 }
 // Actual Andjela dialogue, not just direct pose calls.
 await page.evaluate(()=>{const i=exerciseRoutes.findIndex(r=>r.speaker==='andjela');if(i<0)throw Error('missing route');openExercise(i)});
 for(let i=0;i<3;i++){
 const choice=page.locator('#exercise-options .exercise-choice').first();
 await choice.click();
 if(i<2)await page.getByText('Odluka '+(i+2)+' od 3',{exact:false}).waitFor();
 await page.waitForFunction(()=>document.querySelectorAll('#exercise-portrait .portrait-shot').length===1);
 }
 assert.deepEqual(errors,[]);
 await page.close();
 }
 }
}finally{await browser.close();await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));}
assert.equal(hash(await readFile('kringle/index.html','utf8')),hash(source));
console.log('PASS: original unchanged; six characters, three poses, mobile and desktop, actual Andjela route. Visual review required.');
