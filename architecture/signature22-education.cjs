'use strict';
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const LOCK='4a11f4036309bf517b665e5e698fa142159e386fc2b3ce4b0bea46ca521ac08d';
function educationDocument(bytes){
 if(!Buffer.isBuffer(bytes)||crypto.createHash('sha256').update(bytes).digest('hex')!==LOCK)throw Error('Signature education source changed');
 const source=bytes.toString('utf8');
 const policy=`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; form-action 'none'; object-src 'none'; base-uri 'none'; frame-src 'none'">
<meta name="referrer" content="no-referrer"><meta name="robots" content="noindex,nofollow">
<style id="signatureEducationIsolation">main > :not(#scenario-hub):not(#exercise){display:none!important}body > header, #as-demo, #aurea-v35-choice, #aurea-mode-ribbon, #aurea17Home, #wp-scene-back{display:none!important}body{padding-top:0!important}</style>`;
 const guard=`<script id="signatureEducationGuard">(()=>{'use strict';
 const by=id=>document.getElementById(id);let internal=false;
 function openHub(){internal=true;try{by('wp-open-scenarios').click()}finally{internal=false}}
 function reset(){if(!by('exercise').hidden)by('exercise-back').click();else openHub()}
 document.addEventListener('click',event=>{
  const e=event.target.closest('a,button,input,select,textarea');if(!e||internal||(!event.isTrusted&&['demo','demo-luka','demo-sara','demo-filip','demo-andjela'].includes(e.id)))return;
  if(e.id==='aurea17Start'||e.id==='wp-home'||e.id==='wp-scene-back'){event.preventDefault();event.stopImmediatePropagation();reset();return;}
  if(e.tagName==='A'||(!e.closest('#scenario-hub,#exercise')&&e.id!=='aureaPolishBack')){event.preventDefault();event.stopImmediatePropagation();}
 },true);
 document.addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation()},true);
 const start=()=>{openHub();};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})()</script>`;
 if((source.match(/<head>/gi)||[]).length!==1||(source.match(/<\/body>/gi)||[]).length!==1)throw Error('Unexpected Signature document structure');
 return source.replace(/<head>/i,m=>m+'\n'+policy).replace(/<\/body>/i,m=>guard+'\n'+m);
}
function writeEducation(out){const src=fs.readFileSync(path.join(__dirname,'assets/signature22-kringle.locked.html'));fs.writeFileSync(path.join(out,'signature-education.html'),educationDocument(src));}
module.exports={educationDocument,writeEducation,LOCK};
