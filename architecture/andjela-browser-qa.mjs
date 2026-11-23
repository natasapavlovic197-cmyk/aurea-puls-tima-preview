// AUREA step 3/8: evidence-based, browser-only Anđela QA.
// Two versions, real dialogue, single-frame check, mobile and six semantic labels.
// Produces screenshots + JSON; never writes to any application source or deploys.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const output=resolve('artifacts/andjela-qa');
await mkdir(output,{recursive:true});
const files=[['original','kringle/index.html'],['isolated','kringle-andjela-test/index.html']];
const states=[
  ['attentive','listening'],['concerned','speaking'],
  ['skeptical','reflecting'],['surprised','speaking'],
  ['relieved','listening'],['reflecting','reflecting']
];
const sha=x=>createHash('sha256').update(x).digest('hex').slice(0,20);
async function state(page){
  return page.evaluate(()=>{
    const p=document.getElementById('exercise-portrait');
    const shots=[...(p?.querySelectorAll('.portrait-stage .portrait-shot')||[])];
    const node=shots.at(-1);
    const css=node?.querySelector('.portrait-frame')&&getComputedStyle(node.querySelector('.portrait-frame'));
    const rect=p?.getBoundingClientRect();
    return {
      speaker:p?.dataset.speaker||null,pose:node?.dataset.pose||null,
      emotion:node?.dataset.emotion||null,layerCount:shots.length,
      imagePresent:!!css?.backgroundImage&&css.backgroundImage!=='none',
      position:css?.backgroundPosition||null,size:css?.backgroundSize||null,
      visible:!!rect&&rect.width>100&&rect.height>100,
      portraitSize:rect?{width:Math.round(rect.width),height:Math.round(rect.height)}:null
    };
  });
}
async function capture(page,name){
  const png=await page.locator('#exercise-portrait').screenshot({
    path:resolve(output,name+'.png'),animations:'disabled',timeout:30000
  });
  return sha(png);
}
async function waitPose(page,pose){
  await page.waitForFunction(expected=>{
    const p=document.getElementById('exercise-portrait');
    return p?.dataset.speaker==='andjela' &&
      p.querySelector('.portrait-stage .portrait-shot:last-child')?.dataset.pose===expected;
  },pose,{timeout:20000});
}
function url(file){const u=pathToFileURL(resolve(file));u.searchParams.set('pregled','andjela');u.searchParams.set('andjela-test','1');return u.toString();}
const report={source:'main-source plus QA-only isolation branch',versions:[],acceptance:{threeTrueFaces:false,isolatedNoDoubleFace:false,normalDialogue:false,allSixLabelsMapped:false,mobilePortrait:false},notes:['Six labels are mapped to three genuine photographic faces; this is NOT six distinct facial photographs.']};
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
let failed=false;
try{
  for(const [label,file] of files){
    const v={name:label,checks:[],errors:[],dialogue:[],states:[]};report.versions.push(v);
    const page=await browser.newPage({viewport:{width:1280,height:850},reducedMotion:'no-preference'});
    page.on('pageerror',e=>v.errors.push(e.message));
    try{
      await page.goto(url(file),{waitUntil:'load',timeout:60000});
      await waitPose(page,'listening');
      await page.waitForTimeout(1350);
      const initial=await state(page);
      v.dialogue.push({phase:'opening',...initial,pixelHash:await capture(page,label+'-01-listening')});
      v.checks.push({check:'Opening Anđela actually visible',pass:initial.visible&&initial.imagePresent&&initial.speaker==='andjela'});
      const first=page.locator('#exercise-options .exercise-choice').first();
      await first.click({timeout:20000});
      await waitPose(page,'speaking');
      const mid=await state(page);
      v.dialogue.push({phase:'first-choice-mid-transition',...mid});
      await page.waitForTimeout(1500);
      const speaking=await state(page);
      v.dialogue.push({phase:'speaking',...speaking,pixelHash:await capture(page,label+'-02-speaking')});
      const second=page.locator('#exercise-options .exercise-choice').first();
      await second.click({timeout:20000});
      await waitPose(page,'reflecting');
      const mid2=await state(page);
      v.dialogue.push({phase:'second-choice-mid-transition',...mid2});
      await page.waitForTimeout(1500);
      const reflecting=await state(page);
      v.dialogue.push({phase:'reflecting',...reflecting,pixelHash:await capture(page,label+'-03-reflecting')});
      const poses=v.dialogue.filter(x=>['opening','speaking','reflecting'].includes(x.phase));
      const hashes=new Set(poses.map(x=>x.pixelHash));
      const positions=new Set(poses.map(x=>x.position));
      v.checks.push({check:'Real dialogue changes three poses',pass:poses.map(x=>x.pose).join('|')==='listening|speaking|reflecting'});
      v.checks.push({check:'All three portraits genuinely different',pass:hashes.size===3&&positions.size===3,distinctImages:hashes.size,distinctPositions:positions.size});
      if(label==='isolated'){
        v.checks.push({check:'No overlapping faces during transitions',pass:mid.layerCount===1&&mid2.layerCount===1,observed:[mid.layerCount,mid2.layerCount]});
        report.acceptance.isolatedNoDoubleFace=mid.layerCount===1&&mid2.layerCount===1;
        const diagnostic=page.locator('#aurea-andjela-qa-button');
        await diagnostic.waitFor({timeout:5000});
        for(const [emotion,pose] of states){
          await diagnostic.click({timeout:10000});
          const s=await state(page);
          const hash=await capture(page,'isolated-state-'+emotion);
          v.states.push({label:emotion,expectedPose:pose,pass:s.emotion===emotion&&s.pose===pose&&s.visible&&s.imagePresent,pose:s.pose,imageHash:hash,position:s.position});
        }
        const hashes6=new Set(v.states.map(x=>x.imageHash));
        report.acceptance.allSixLabelsMapped=v.states.length===6&&v.states.every(x=>x.pass)&&hashes6.size===3;
        v.checks.push({check:'Six semantic labels show their mapped genuine poses',pass:report.acceptance.allSixLabelsMapped,distinctVisualFaces:hashes6.size});
        // Confirm responsive portrait in mobile viewport; no publishing needed.
        await page.setViewportSize({width:390,height:844});
        const mob=await state(page);
        v.checks.push({check:'Mobile Anđela portrait visible and undistorted container',pass:mob.visible&&mob.portraitSize.width>150&&mob.portraitSize.width<390});
        report.acceptance.mobilePortrait=mob.visible&&mob.portraitSize.width>150&&mob.portraitSize.width<390;
        await page.screenshot({path:resolve(output,'isolated-mobile-dialogue.png'),fullPage:false});
      }
      v.checks.push({check:'No uncaught browser exceptions',pass:v.errors.length===0,errorCount:v.errors.length});
      if(v.checks.some(x=>!x.pass))failed=true;
    }catch(e){
      v.checks.push({check:'Browser scenario completed',pass:false,error:String(e?.stack||e).slice(0,2000)});
      failed=true;
    }finally{await page.close();}
    console.log(JSON.stringify({name:v.name,checks:v.checks,dialogue:v.dialogue.map(x=>({phase:x.phase,pose:x.pose,layerCount:x.layerCount,position:x.position})),states:v.states},null,2));
  }
}finally{await browser.close();}
report.acceptance.normalDialogue=report.versions.every(v=>v.checks.some(c=>c.check==='Real dialogue changes three poses'&&c.pass));
report.acceptance.threeTrueFaces=report.versions.every(v=>v.checks.some(c=>c.check==='All three portraits genuinely different'&&c.pass));
if(!Object.values(report.acceptance).every(Boolean))failed=true;
await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2),'utf8');
console.log('AUREA Anđela QA summary: '+JSON.stringify(report.acceptance));
console.log(failed?'FAIL: check report.json and screenshots':'PASS: three photographic faces, normal interactions, isolated no-ghost transitions, mobile and six mapped labels.');
console.log('Naturalness is a separate human visual judgment; this test cannot certify six distinct photographs.');
if(failed)process.exitCode=1;