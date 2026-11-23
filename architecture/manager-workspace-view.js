'use strict';
function mountManagerWorkspace(root,client){
 if(!root||typeof client?.load!=='function'||typeof client?.save!=='function')throw new TypeError('Missing workspace');
 const doc=root.ownerDocument;
 function node(tag,text,cls){const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
 let disposed=false,busy=false;
 async function refresh(){
  if(disposed||busy)return;
  busy=true;root.replaceChildren(node('p','Učitavanje poslovnog pregleda…','muted'));
  try{
   const data=await client.load();
   if(disposed)return;
   const view=data.report.view;
   if(view?.kind!=='privacy_cleared_item_aggregates'||!Array.isArray(view.domains)||view.domains.length!==10)throw Error('Invalid report');
   const panel=node('section',undefined,'panel section');panel.append(node('h2','Moj pregled'),node('p','Grupni rezultati · '+view.coverage.measuredDomains+' od 10 oblasti','muted'));
   const grid=node('div',undefined,'five');
   for(const d of view.domains){
    const tile=node('div',undefined,'metric');tile.append(node('h3',d.label));
    if(!d.items.length)tile.append(node('p','Nema dovoljno objavljenih podataka.','fine'));
    for(const item of d.items)tile.append(node('p',item.itemCode+' · '+item.latestFavorablePercent+'% povoljnih odgovora','fine'));
    grid.append(tile);
   }
   panel.append(grid,node('p','Rezultati pojedinačnih pitanja, ne zbirni skorovi oblasti.','fine'));
   const actions=node('section',undefined,'panel section');actions.append(node('h2','Moje aktivnosti'));
   const form=node('form');const desc=node('textarea');desc.required=true;desc.minLength=3;desc.maxLength=2000;desc.setAttribute('aria-label','Opis aktivnosti');const due=node('input');due.type='date';due.setAttribute('aria-label','Rok aktivnosti');const save=node('button','Sačuvaj aktivnost','btn primary');const msg=node('p','','fine');msg.setAttribute('role','status');let editing=null;
   for(const rec of data.report.recommendations||[]){const box=node('div',undefined,'notice');box.append(node('h3',rec.title),node('p',rec.evidence,'fine'),node('p',rec.action),node('p',rec.check,'fine'));const use=node('button','Koristi predlog kao osnovu plana','btn');use.type='button';use.onclick=()=>{editing=null;status.value='open';desc.value=rec.action;due.value='';desc.focus();};box.append(use);panel.append(box);}
   const status=node('select');status.setAttribute('aria-label','Status aktivnosti');for(const [value,label] of [['open','Otvoreno'],['done','Završeno']]){const opt=node('option',label);opt.value=value;status.append(opt);}

   for(const a of data.activities){
    const row=node('div',undefined,'notice');row.append(node('p',a.description),node('p','Rok: '+(a.due_on||'Nije određen')+' · '+({open:'Otvoreno',done:'Završeno',in_progress:'U toku',cancelled:'Otkazano'}[a.status]||'Nepoznato'),'fine'));
    if(['open','done'].includes(a.status)){const edit=node('button','Izmeni','btn');edit.type='button';edit.onclick=()=>{editing=a;status.value=a.status;desc.value=a.description;due.value=a.due_on||'';desc.focus();};row.append(edit);}
    actions.append(row);
   }
   form.append(desc,due,status,save,msg);actions.append(form);
   form.onsubmit=async e=>{e.preventDefault();if(busy||disposed)return;busy=true;save.disabled=true;try{await client.save({description:desc.value,dueOn:due.value||null,actionId:editing?.id||null,status:status.value});busy=false;await refresh();}catch{msg.textContent='Aktivnost nije potvrđena. Proverite vezu i pokušajte ponovo.';}finally{busy=false;save.disabled=false;}};
   root.replaceChildren(panel,actions);
  }catch{if(!disposed)root.replaceChildren(node('p','Poslovni pregled trenutno nije dostupan.','notice'));}
  finally{busy=false;}
 }
 return Object.freeze({refresh,dispose(){disposed=true;root.replaceChildren();}});
}
if(typeof module!=='undefined')module.exports={mountManagerWorkspace};
