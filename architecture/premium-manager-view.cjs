'use strict';
const {anchors,rotation,weeklyItems}=require('./psychometric-item-bank.cjs');
const ITEMS=[...anchors,...rotation.flat()];
const ITEM_LABELS={A_CLARITY:'Jasnoća očekivanja',A_WORKLOAD:'Održivo radno opterećenje',A_SPEAKUP:'Sloboda ukazivanja na problem',R_LEADER_HELP:'Dostupnost podrške rukovodioca',R_INFO:'Pravovremenost informacija',R_PRIORITY:'Jasnoća promenjenih prioriteta',R_COOP:'Međusobna pomoć',R_TRUST:'Pouzdanost dogovora',R_FEEDBACK:'Povratne informacije',R_AUTONOMY:'Samostalnost u radu',R_FAIRNESS:'Pravičnost raspodele zadataka',R_RECOGNITION:'Prepoznavanje truda',R_MEANING:'Smisao posla',R_RECOVERY:'Oporavak između radnih dana',R_RESOURCES:'Dostupnost radnih resursa'};
const PRIMARY=['role_clarity','workload','communication','psychological_safety','team_collaboration'];
const COLORS=Object.freeze({role_clarity:'#481c29',workload:'#a17a4e',communication:'#84634e',psychological_safety:'#956775',team_collaboration:'#78505f',leadership_support:'#653441',autonomy:'#9b795e',fairness_recognition:'#805b75',engagement_meaning:'#8b713e',recovery:'#71615c'});
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statusLabel=s=>({open:'Otvoreno',done:'Završeno',in_progress:'U toku',cancelled:'Otkazano'}[s]||'Nepoznato');
const weekMs=604800000;
function validate(data){
 const v=data?.report?.view, history=data?.report?.history;
 if(v?.kind!=='privacy_cleared_item_aggregates'||!Array.isArray(v.domains)||v.domains.length!==10||new Set(v.domains.map(d=>d.code)).size!==10||!Array.isArray(history)||!Array.isArray(data.activities))throw Error('Invalid report');
 const seen=new Set();
 for(const p of history){
 const item=weeklyItems(p.weekStart).find(q=>q.code===p.itemCode);
 const key=p.weekStart+'|'+p.itemCode+'|'+p.itemVersion;
 if(!item||seen.has(key)||!Number.isInteger(p.itemVersion)||p.itemVersion<1||!Number.isSafeInteger(p.responseCount)||p.responseCount<5||!Number.isFinite(p.favorablePercent)||p.favorablePercent<0||p.favorablePercent>100)throw Error('Invalid publication');
 seen.add(key);
 }
 return data;
}
function mountPremiumManager(root,client){
 let disposed=false,busy=false,data=null,screen='overview',expanded=false,selected='workload',chosen={},draft={description:'',dueOn:'',actionId:null,status:'open'},error='',guide=0;
 const $=id=>root.querySelector('#'+id);
 function itemFor(domain){
 const items=ITEMS.filter(q=>q.domain===domain);
 const code=chosen[domain]?.code||items[0]?.code;
 const versions=[...new Set(data.report.history.filter(p=>p.itemCode===code).map(p=>p.itemVersion))].sort((a,b)=>b-a);
 const version=versions.includes(chosen[domain]?.version)?chosen[domain].version:versions[0];
 return {code,version,versions,items};
 }
 function series(domain){const {code,version}=itemFor(domain);return data.report.history.filter(p=>p.itemCode===code&&p.itemVersion===version).sort((a,b)=>a.weekStart.localeCompare(b.weekStart));}
 function delta(p){const a=p.at(-2),b=p.at(-1);if(!a||!b)return 'Nema uporedivog merenja';const interval=anchors.some(q=>q.code===b.itemCode)?1:4;if((Date.parse(b.weekStart)-Date.parse(a.weekStart))/weekMs!==interval)return 'Nema uporedivog merenja';const d=Number((b.favorablePercent-a.favorablePercent).toFixed(1));return (d>=0?'+':'')+d+' pp';}
 function chart(points,color){
 if(!points.length)return '<p class="notice">Nema dovoljno objavljenih podataka za ovaj pokazatelj.</p>';
 const end=Date.parse(points.at(-1).weekStart),start=Math.max(end-11*weekMs,Date.parse(points[0].weekStart)),visible=points.filter(p=>Date.parse(p.weekStart)>=start);
 const span=Math.max(weekMs,end-start),x=p=>40+(Date.parse(p.weekStart)-start)/span*276,y=v=>185-v*155/100;
 const cadence=anchors.some(q=>q.code===points[0].itemCode)?1:4;
 const pairs=visible.slice(1).flatMap((p,i)=>(Date.parse(p.weekStart)-Date.parse(visible[i].weekStart))/weekMs===cadence?[[visible[i],p]]:[]);
 const areas=pairs.map(([a,b])=>'<path d="M '+x(a)+' '+y(a.favorablePercent)+' L '+x(b)+' '+y(b.favorablePercent)+' L '+x(b)+' 185 L '+x(a)+' 185 Z" fill="'+color+'" fill-opacity=".07"/>').join('');
 const lines=pairs.map(([a,b])=>'<line x1="'+x(a)+'" y1="'+y(a.favorablePercent)+'" x2="'+x(b)+'" y2="'+y(b.favorablePercent)+'" stroke="'+color+'" stroke-width="2.5" stroke-linecap="round"/>').join('');
 const ticks=[...new Set([0,Math.round((visible.length-1)/2),visible.length-1])].filter(i=>i>=0);
 return '<svg class="chart" viewBox="0 0 338 215" style="max-width:650px;margin:14px auto" role="img" aria-label="Trend objavljenih grupnih rezultata">'+[0,25,50,75,100].map(v=>'<line x1="40" y1="'+y(v)+'" x2="316" y2="'+y(v)+'" stroke="#e4d6cb"/><text x="3" y="'+(y(v)+4)+'" fill="#756c69" font-size="11">'+v+'%</text>').join('')+areas+lines+visible.map(p=>'<circle cx="'+x(p)+'" cy="'+y(p.favorablePercent)+'" r="4.5" fill="'+color+'" stroke="white" stroke-width="1.5"><title>'+safe(p.weekStart)+' · '+p.favorablePercent+'% · n='+p.responseCount+'</title></circle>').join('')+ticks.map(i=>'<text x="'+x(visible[i])+'" y="207" fill="#756c69" font-size="10" text-anchor="middle">'+safe(visible[i].weekStart.slice(8,10)+'.'+visible[i].weekStart.slice(5,7)+'.')+'</text>').join('')+'</svg>';
 }
 function remember(){if($('actionText'))draft.description=$('actionText').value;if($('due'))draft.dueOn=$('due').value;if($('actionStatus'))draft.status=$('actionStatus').value;}
 function go(s){if(busy||disposed)return;remember();screen=s;error='';render();}
 function render(){
 if(disposed||!data)return;
 const nav='<nav class="v35nav" aria-label="Navigacija rukovodioca">'+[['overview','Moj pregled'],['activities','Moje aktivnosti'],['guidance','Plan za tim']].map(([s,t])=>'<button class="btn" data-screen="'+s+'" '+(screen===s?'aria-current="page"':'')+'>'+t+'</button>').join('')+'</nav>';
 let content='';
 if(screen==='overview'){
 const domains=data.report.view.domains.slice().sort((a,b)=>{const ai=PRIMARY.indexOf(a.code),bi=PRIMARY.indexOf(b.code);return (ai<0?10:ai)-(bi<0?10:bi)});
 const tile=d=>{const p=series(d.code),last=p.at(-1),color=COLORS[d.code]||'#653441';return '<button class="metric '+(selected===d.code?'selected':'')+'" data-domain="'+safe(d.code)+'" aria-pressed="'+(selected===d.code)+'"><span style="color:'+color+'">●</span> '+safe(d.label)+(last?'<strong style="color:'+color+'">'+last.favorablePercent+'%</strong><div class="meter"><div class="fill" style="width:'+last.favorablePercent+'%;background:'+color+'"></div></div><small>'+delta(p)+' · n='+last.responseCount+' · '+safe(last.weekStart)+' · verzija '+last.itemVersion+'</small>':'<strong>—</strong><small>Nema objavljenog rezultata</small>')+'</button>'};
 const p=series(selected),last=p.at(-1),sel=itemFor(selected),d=domains.find(x=>x.code===selected),color=COLORS[d.code]||'#653441';
 const rec=(data.report.recommendations||[])[0];
 content='<div class="section"><span class="eyebrow" style="color:var(--wine2)">Nedeljni pregled · Objavljeni grupni rezultati</span><h2>Kako se menjaju odgovori zaposlenih?</h2><p class="muted">Rezultati pojedinačnih pitanja, ne zbirni skorovi oblasti.</p>'+(rec?'<div class="aurea-insight"><div class="aurea-insight-label">GRUPNI SIGNAL</div><h3>'+safe(rec.title)+'</h3><p>'+safe(rec.evidence)+'</p><p>'+safe(rec.action)+'</p><button class="btn primary" id="aureaStartPlan">Odaberite sledeći korak</button></div>':'<div class="notice">Nema ponovljenog nepovoljnog signala koji ispunjava pravila za preporuku. Pojedinačne promene i dalje možete razmotriti u trendovima.</div>')+'<h3 class="aurea-data-heading">Pokazatelji po oblastima</h3></div><div class="five">'+domains.filter(d=>expanded||PRIMARY.includes(d.code)).map(tile).join('')+'</div><div class="actions"><button class="btn" id="aureaExpandDomains" aria-expanded="'+expanded+'">'+(expanded?'Sažmi pregled':'Prikaži svih deset oblasti')+'</button></div><div class="panel section fade"><div class="switch" style="justify-content:space-between"><div><span class="eyebrow" style="color:var(--wine2)">Signature Trend</span><h2>'+safe(d.label)+'</h2></div><span class="pill">'+(anchors.some(q=>q.code===sel.code)?'Nedeljno merenje':'Merenje svake 4 nedelje')+'</span></div><label for="aureaItemSelect">Pokazatelj u oblasti</label><select class="field" id="aureaItemSelect">'+sel.items.map(q=>'<option value="'+q.code+'" '+(q.code===sel.code?'selected':'')+'>'+safe(ITEM_LABELS[q.code]||'Pokazatelj')+'</option>').join('')+'</select><label for="itemVersion">Verzija pitanja</label><select class="field" id="itemVersion" '+(!sel.versions.length?'disabled':'')+'>'+(sel.versions.length?sel.versions.map(v=>'<option value="'+v+'" '+(v===sel.version?'selected':'')+'>v'+v+'</option>').join(''):'<option>Nema podataka</option>')+'</select>'+(last?'<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:12px 0"><div class="notice" style="border-color:'+color+'"><small>Poslednji rezultat</small><h2 style="color:'+color+';margin:4px 0">'+last.favorablePercent+'%</h2></div><div class="notice"><small>Promena prema prethodnom uporedivom merenju</small><p style="font-size:18px;color:#653441;margin:4px 0">'+safe(delta(p))+'</p></div></div>':'')+chart(p,color)+'<div class="statline">'+(last?'<span>Poslednji rezultat: '+last.favorablePercent+'%</span><span>Promena: '+delta(p)+'</span><span>Važeći odgovori: n='+last.responseCount+' · '+safe(last.weekStart)+'</span>':'<span>Nema objavljenog merenja</span>')+'</div><details style="margin-top:16px"><summary style="cursor:pointer;color:var(--wine2)">Kako čitati rezultate?</summary><p class="fine">Najmanje 5 važećih odgovora po pitanju i ciklusu. Neprimenljivi odgovori nisu u imeniocu. Poređenja samo unutar istog pitanja i verzije; praznine nisu procene. Nazivi pokazatelja su sažeti opisi, ne istorijski tekst pitanja. Nije validirani indeks oblasti.</p></details></div>';
 }else if(screen==='activities'){
 content='<div class="panel section fade"><h2>Moje aktivnosti</h2>'+(!data.activities.length?'<p class="notice">Još nemate sačuvanih aktivnosti.</p>':'')+data.activities.map((a,i)=>'<div class="notice"><b>'+safe(a.description)+'</b><p>Rok: '+safe(a.due_on||'Nije određen')+' · Status: '+safe(statusLabel(a.status))+'</p>'+(['open','done'].includes(a.status)?'<button class="btn" data-edit="'+i+'">Izmeni aktivnost</button>':'')+'</div>').join('')+'<button class="btn primary" id="newAction">Odredi prvi korak</button></div>';
 }else if(screen==='complete'){
 content='<section class="v35completion aurea-finale" role="status"><div class="aurea-finale-kicker">AUREA / PULS TIMA</div><div class="aurea-finale-rule"></div><div class="aurea-finale-mark"></div><h2>Vaš plan za naredni period</h2><p class="aurea-finale-lead">Aktivnost je potvrđena na serveru.</p><div class="aurea-finale-actions"><button class="btn primary" data-screen="overview">Moj pregled</button><button class="btn" data-screen="activities">Moje aktivnosti</button></div></section>';
 }else{
 const rec=(data.report.recommendations||[])[0];
 content='<div class="panel section fade" id="guide"><span class="eyebrow" style="color:var(--wine2)">PLAN ZA TIM · KORAK '+(guide+1)+' OD 3</span>'+(guide===0?'<h2>Šta bi trebalo prvo proveriti?</h2><div class="notice">'+safe(rec?rec.action:'Odaberite organizacionu temu na osnovu sopstvenih zapažanja.')+'</div>'+(rec?'<button class="btn" id="useRec">Koristi predlog kao osnovu plana</button>':'')+'<button class="btn primary" id="nextManager">Nastavite</button>':guide===1?'<h2>Šta ste zapazili u radu tima?</h2><p>Razmotrite sopstvena zapažanja bez zaključivanja o pojedincima.</p><button class="btn" id="backManager">Nazad</button><button class="btn primary" id="nextManager">Sastavite plan aktivnosti</button>':'<h2>Koji korak možete da preduzmete?</h2><label for="actionText">Aktivnost</label><textarea class="field" id="actionText" aria-label="Opis aktivnosti" maxlength="2000">'+safe(draft.description)+'</textarea><label for="due">Rok</label><input class="field" id="due" aria-label="Rok aktivnosti" type="date" value="'+safe(draft.dueOn)+'"><label for="actionStatus">Status</label><select class="field" id="actionStatus"><option value="open" '+(draft.status==='open'?'selected':'')+'>Otvoreno</option><option value="done" '+(draft.status==='done'?'selected':'')+'>Završeno</option></select><div class="actions"><button class="btn" id="backManager">Nazad</button><button class="btn primary" id="saveAction" '+(busy?'disabled':'')+'>Sačuvaj aktivnost</button></div>')+'</div>';
 }
 root.innerHTML=nav+content+(error?'<p role="alert" class="notice">'+safe(error)+'</p>':'');
 root.querySelectorAll('[data-screen]').forEach(b=>b.onclick=()=>go(b.dataset.screen));
 root.querySelectorAll('[data-domain]').forEach(b=>b.onclick=()=>{selected=b.dataset.domain;render()});
 if($('aureaExpandDomains'))$('aureaExpandDomains').onclick=()=>{expanded=!expanded;if(!expanded&&!PRIMARY.includes(selected))selected='workload';render()};
 if($('aureaItemSelect'))$('aureaItemSelect').onchange=e=>{chosen[selected]={code:e.target.value};render()};
 if($('itemVersion'))$('itemVersion').onchange=e=>{chosen[selected]={code:itemFor(selected).code,version:Number(e.target.value)};render()};
 if($('aureaStartPlan'))$('aureaStartPlan').onclick=()=>{guide=0;go('guidance')};
 if($('newAction'))$('newAction').onclick=()=>{draft={description:'',dueOn:'',actionId:null,status:'open'};guide=0;go('guidance')};
 root.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{const a=data.activities[Number(b.dataset.edit)];draft={description:a.description,dueOn:a.due_on||'',actionId:a.id,status:a.status};guide=2;go('guidance')});
 if($('nextManager'))$('nextManager').onclick=()=>{remember();guide++;render()};
 if($('backManager'))$('backManager').onclick=()=>{remember();guide--;render()};
 if($('useRec'))$('useRec').onclick=()=>{draft.description=data.report.recommendations[0].action;guide=2;render()};
 if($('saveAction'))$('saveAction').onclick=async()=>{if(busy||disposed)return;remember();if(draft.description.trim().length<3){error='Unesite opis aktivnosti.';render();return}busy=true;error='';render();try{await client.save({...draft,dueOn:draft.dueOn||null});if(disposed)return;try{data=validate(await client.load())}catch{data=null;root.textContent='Aktivnost je sačuvana, ali osvežavanje pregleda nije uspelo.';return}if(disposed)return;screen='complete';draft={description:'',dueOn:'',actionId:null,status:'open'};guide=0;}catch{error='Aktivnost nije potvrđena. Proverite vezu i pokušajte ponovo.'}finally{busy=false;if(!disposed&&data)render()}};
 }
 async function refresh(){if(disposed||busy)return;busy=true;data=null;root.textContent='Učitavanje poslovnog pregleda…';try{const next=validate(await client.load());if(!disposed){data=next;render()}}catch{if(!disposed){root.innerHTML='<p role="alert" class="notice">Poslovni pregled trenutno nije dostupan.</p><button class="btn" id="retryOverview">Pokušajte ponovo</button>';$('retryOverview').onclick=refresh}}finally{busy=false}}
 return {refresh,dispose(){disposed=true;data=null;draft={};root.replaceChildren()}};
}
module.exports={mountPremiumManager};
