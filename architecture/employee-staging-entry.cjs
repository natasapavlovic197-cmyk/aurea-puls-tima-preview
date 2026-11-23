'use strict';
const {createEmployeeClient}=require('./employee-live-client.cjs');
const root=document.getElementById('employee');
const labels=['Uopšte se ne slažem','Uglavnom se ne slažem','Niti se slažem niti se ne slažem','Uglavnom se slažem','Potpuno se slažem','Ne mogu da procenim / nije primenljivo'];
const token=location.hash.slice(1);history.replaceState(null,'',location.pathname);
function node(tag,text,cls){const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;}
function message(text){root.replaceChildren(node('div',text,'panel'));}
async function start(){
 message('Učitavanje pitanja…');
 const client=createEmployeeClient({token});const questions=await client.load();
 let step=0,busy=false;const answers=Object.create(null);
 function render(){
 const q=questions[step],panel=node('div','','panel fade');
 panel.append(node('p','Pitanje '+(step+1)+' od 6','statline'),node('h2',q.wording,'question'));
 const choices=node('div','','choices');
 labels.forEach((label,i)=>{const l=node('label','','choice'+(answers[q.code]===i+1?' on':''));const input=document.createElement('input');input.type='radio';input.name='answer';input.checked=answers[q.code]===i+1;input.disabled=busy;input.onchange=()=>{answers[q.code]=i+1;render();};l.append(input,node('span',label));choices.append(l);});
 const actions=node('div','','actions'),prev=node('button','← Nazad','btn'),next=node('button',step===5?'Pošaljite odgovore':'Dalje','btn primary');
 prev.disabled=busy||step===0;next.disabled=busy||!answers[q.code];prev.onclick=()=>{step--;render();};
 next.onclick=async()=>{if(busy||!answers[q.code])return;if(step<5){step++;render();return;}busy=true;render();try{await client.submit(answers);root.replaceChildren(node('div','Hvala na izdvojenom vremenu. Vaši odgovori su primljeni.','panel aurea-finale'));}catch{busy=false;render();root.append(node('p','Predaja nije potvrđena. Proverite vezu ili status poziva.','fine'));}};
 actions.append(prev,next);panel.append(choices,actions);root.replaceChildren(panel);
 }
 render();
}
start().catch(()=>message('Poziv nije dostupan ili je već iskorišćen.'));
