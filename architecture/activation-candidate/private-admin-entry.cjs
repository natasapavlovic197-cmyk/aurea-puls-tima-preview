'use strict';
const {createClient}=require('@supabase/supabase-js');
const {createAdminConsole}=require('./admin-console.cjs');
const {createProductionPublicConfig}=require('../postgrest-runtime/production-public-config.cjs');
const $=id=>document.getElementById(id);
const cfg=createProductionPublicConfig({environment:'production'});
const c=createAdminConsole({createClient,key:cfg.key,endpoint:'https://puls.aureapsihoterapija.com/.netlify/functions/aurea-admin'});
let factorId=null,busy=false;
function state(s){$('login').hidden=s!=='login';$('mfa').hidden=s!=='mfa';$('workspace').hidden=s!=='ready';}
async function run(fn){if(busy)return;busy=true;$('status').textContent='Obrada…';try{await fn();$('status').textContent='Zahtev potvrđen.'}catch{$('status').textContent='Zahtev odbijen ili nije potvrđen.'}finally{busy=false;}}
$('login').onsubmit=e=>{e.preventDefault();run(async()=>{const pw=$('password').value;$('password').value='';const x=await c.signIn($('email').value,pw);factorId=x.factorId||null;state(x.status==='challenge'?'mfa':'ready');});};
$('mfa').onsubmit=e=>{e.preventDefault();run(async()=>{const code=$('code').value;$('code').value='';await c.verify(factorId,code);factorId=null;state('ready');});};
$('reload').onclick=()=>run(async()=>{$('data').textContent=JSON.stringify(await c.call('list'),null,2);});
$('logout').onclick=()=>run(async()=>{try{await c.signOut();}finally{$('data').textContent='';$('payload').value='{}';state('login');}});
$('command').onsubmit=e=>{e.preventDefault();run(async()=>{const action=$('action').value,payload=JSON.parse($('payload').value);if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error();if(!['list','billing_list'].includes(action)&&!window.confirm('Potvrdite administratorsku izmenu.'))return;$('data').textContent=JSON.stringify(await c.call(action,payload),null,2);});};
state('login');
