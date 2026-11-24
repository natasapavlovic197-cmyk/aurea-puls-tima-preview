'use strict';
const {guide}=require('./signature22-guide.cjs');
const {createEmployeeClient}=require('./employee-live-client.cjs');
const {snapshot,renderPersonalInsights}=require('./employee-personal-insights.cjs');
const {mountHistory}=require('./employee-personal-history-ui.cjs');
const {anchors,rotation}=require('./psychometric-item-bank.cjs');
const domains={role_clarity:'Jasnoća uloge',communication:'Komunikacija',workload:'Radno opterećenje',psychological_safety:'Psihološka sigurnost',leadership_support:'Podrška rukovodioca',team_collaboration:'Timska saradnja',autonomy:'Autonomija',fairness_recognition:'Pravičnost i priznanje',engagement_meaning:'Angažovanost i smisao',recovery:'Oporavak'};
const itemDomains=Object.fromEntries([...anchors,...rotation.flat()].map(q=>[q.code,q.domain]));
const root=document.getElementById('employee');
const labels=['Uopšte se ne slažem','Uglavnom se ne slažem','Niti se slažem niti se ne slažem','Uglavnom se slažem','Potpuno se slažem','Ne mogu da procenim / nije primenljivo'];
const token=location.hash.slice(1);history.replaceState(null,'',location.pathname);
const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function message(s){root.innerHTML='<div class="panel fade" role="status">'+safe(s)+'</div>'}
async function start(){
 message('Učitavanje pitanja…');
 const cfg=globalThis.AUREA_STAGING_CONFIG;
 const transport=cfg?.transport==='postgrest'?require('./postgrest-runtime/browser-transport.cjs').createPostgrestTransport(cfg):undefined;
 const client=createEmployeeClient({token,fetchImpl:transport});const questions=await client.load();
 let step=0,busy=false;const answers=Object.create(null);
 function render(error=''){
 const q=questions[step];
 root.innerHTML='<div class="panel fade"><div class="switch"><span class="pill">Zaposleni · Nedeljni puls</span></div><div class="statline" style="margin-top:14px"><span>Pitanje '+(step+1)+' od 6</span><span>Poslednjih sedam dana</span></div><div class="progress"><div style="width:'+((step+1)*100/6)+'%"></div></div><div class="eyebrow" style="color:var(--wine2)">'+safe(domains[itemDomains[q.code]]||'Radno iskustvo')+'</div>'+(step===0?guide:'')+'<div class="question">'+safe(q.wording)+'</div><div class="choices">'+labels.map((t,i)=>'<label class="choice '+(answers[q.code]===i+1?'on':'')+'"><input type="radio" name="answer" value="'+(i+1)+'" '+(answers[q.code]===i+1?'checked':'')+' '+(busy?'disabled':'')+'><span>'+safe(t)+'</span></label>').join('')+'</div><div class="actions"><button class="btn" id="prev" '+(busy||step===0?'disabled':'')+'><span aria-hidden="true">←</span> Nazad</button><button class="btn primary" id="next" '+(busy||!answers[q.code]?'disabled':'')+'>'+(busy?'Slanje…':step===5?'Pošaljite odgovore':'Dalje')+'</button></div><p class="fine">Odaberite odgovor koji najbolje opisuje Vaše iskustvo. Ako nešto ne možete da procenite, slobodno izaberite tu opciju.</p>'+(error?'<p class="fine" role="alert">'+safe(error)+'</p>':'')+'</div>';
 root.querySelectorAll('input').forEach(x=>x.onchange=()=>{if(!busy){answers[q.code]=Number(x.value);render()}});
 root.querySelector('#prev').onclick=()=>{if(!busy&&step>0){step--;render()}};
 root.querySelector('#next').onclick=async()=>{if(busy||!answers[q.code])return;if(step<5){step++;render();return}busy=true;render();try{await client.submit(answers)}catch{busy=false;render('Predaja nije potvrđena. Proverite vezu ili status poziva.');return}
 let personal=null;try{personal=snapshot(questions,answers)}catch{}
 for(const k of Object.keys(answers))delete answers[k];
 root.innerHTML='<div class="panel fade aurea-finale" role="status"><div class="aurea-finale-kicker">AUREA / PULS TIMA</div><div class="aurea-finale-rule"></div><div class="aurea-finale-mark" aria-hidden="true"></div>'+guide+'<h2>Hvala na izdvojenom vremenu.</h2><p class="aurea-finale-lead">Vaši odgovori su primljeni. Vaše iskustvo je važno za razumevanje načina na koji tim funkcioniše.</p><div class="aurea-finale-rule"></div><p class="aurea-finale-disclaimer">Rukovodilac nema pristup individualnim odgovorima kroz ovaj sistem.</p></div>'
 if(personal){const actions=document.createElement('div');actions.className='aurea-finale-actions';const b=document.createElement('button');b.type='button';b.className='btn';b.textContent='Pogledajte svoj lični puls';actions.append(b);root.querySelector('.aurea-finale').append(actions);b.onclick=()=>{try{const panel=document.createElement('div');panel.innerHTML=renderPersonalInsights(personal);root.append(panel);actions.remove();const history=document.createElement('div');panel.append(history);const dispose=mountHistory(history,personal);personal=null;panel.querySelector('#personal-dismiss').onclick=()=>{dispose();panel.remove()};panel.scrollIntoView({block:'start'})}catch{personal=null;actions.remove()}}}
 };
 }
 render();
}
start().catch(()=>message('Poziv nije dostupan ili je već iskorišćen.'));
