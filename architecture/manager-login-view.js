'use strict';
function mountManagerLogin(root,{signIn,openWorkspace}){
 const doc=root.ownerDocument;
 let active=null,busy=false,disposed=false;
 function element(tag,text){const e=doc.createElement(tag);if(text)e.textContent=text;return e;}
 const heading=element('h1','AUREA · Poslovni prostor');
 const form=element('form'),email=element('input'),password=element('input'),submit=element('button','Prijavite se'),message=element('p'),companies=element('section'),workspace=element('section');
 email.type='email';email.required=true;email.autocomplete='username';email.setAttribute('aria-label','Email adresa');
 password.type='password';password.required=true;password.autocomplete='current-password';password.setAttribute('aria-label','Lozinka');
 email.className=password.className='field';submit.className='btn primary';submit.type='submit';message.setAttribute('role','status');form.append(email,password,submit);
 root.replaceChildren(heading,form,message,companies,workspace);
 form.addEventListener('submit',async event=>{
 event.preventDefault();if(busy||disposed)return;busy=true;submit.disabled=true;message.textContent='Prijava je u toku…';
 try{
 const provider=await signIn(email.value,password.value);password.value='';
 if(disposed){await provider.signOut();return;}
 active=await openWorkspace(workspace,provider);
 if(disposed){await active.signOut();return;}
 form.hidden=true;message.textContent='Izaberite kompaniju.';
 const logout=element('button','Odjavite se');logout.type='button';logout.className='btn';
 logout.onclick=async()=>{const current=active;active=null;companies.replaceChildren();workspace.replaceChildren();form.hidden=false;message.textContent='Odjavljeni ste.';try{await current?.signOut();}catch{message.textContent='Lokalna sesija je zatvorena. Odjava na serveru nije potvrđena.';}};
 companies.append(logout);
 for(const company of active.companies){const button=element('button',company.name);button.type='button';button.className='btn';button.onclick=async()=>{try{await active.select(company.id);message.textContent='';}catch{message.textContent='Pristup kompaniji nije dostupan.';}};companies.append(button);}
 if(!active.companies.length)message.textContent='Nemate dodeljenu kompaniju.';
 }catch{password.value='';message.textContent='Prijava nije uspela.';}finally{busy=false;submit.disabled=false;}
 });
 return {dispose(){disposed=true;active?.dispose();root.replaceChildren();}};
}
if(typeof module!=='undefined')module.exports={mountManagerLogin};
