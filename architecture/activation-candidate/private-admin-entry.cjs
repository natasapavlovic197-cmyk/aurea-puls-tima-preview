'use strict';
const {createClient}=require('@supabase/supabase-js');
const {createAdminConsole}=require('./admin-console.cjs');
const {createProductionPublicConfig}=require('../postgrest-runtime/production-public-config.cjs');
const $=id=>document.getElementById(id);
const cfg=createProductionPublicConfig({environment:'production'});
const c=createAdminConsole({createClient,key:cfg.key,endpoint:'https://puls.aureapsihoterapija.com/.netlify/functions/aurea-admin'});
let factorId=null,busy=false;
function clearEnrollment(){$('enroll-secret').textContent='';$('enroll-instructions').hidden=true;$('enroll-start').disabled=false;factorId=null;}
function state(s){$('login').hidden=s!=='login';$('mfa').hidden=s!=='mfa'&&s!=='enroll_verify';$('enroll').hidden=s!=='enroll'&&s!=='enroll_verify';$('workspace').hidden=s!=='ready';$('cancel').hidden=!['mfa','enroll','enroll_verify'].includes(s);if(s==='login'||s==='ready')clearEnrollment();}
async function run(fn){if(busy)return;busy=true;$('status').textContent='Obrada…';try{await fn();$('status').textContent='Zahtev potvrđen.'}catch{$('status').textContent='Zahtev odbijen ili nije potvrđen.'}finally{busy=false;}}
$('login').onsubmit=e=>{e.preventDefault();run(async()=>{const pw=$('password').value;$('password').value='';const x=await c.signIn($('email').value,pw);factorId=x.factorId||null;state(x.status==='challenge'?'mfa':x.status==='enrollment_required'?'enroll':'ready');});};
$('enroll-start').onclick=()=>run(async()=>{const x=await c.enroll();factorId=x.factorId;$('enroll-secret').textContent=x.secret;$('enroll-instructions').hidden=false;$('enroll-start').disabled=true;state('enroll_verify');});
$('cancel').onclick=()=>run(async()=>{try{await c.signOut();}finally{clearEnrollment();$('code').value='';state('login');}});
$('mfa').onsubmit=e=>{e.preventDefault();run(async()=>{const code=$('code').value;$('code').value='';await c.verify(factorId,code);clearEnrollment();state('ready');});};
$('reload').onclick=()=>run(async()=>{$('data').textContent=JSON.stringify(await c.call('list'),null,2);});
$('logout').onclick=()=>run(async()=>{try{await c.signOut();}finally{$('data').textContent='';$('payload').value='{}';state('login');}});
$('command').onsubmit=e=>{e.preventDefault();run(async()=>{const action=$('action').value,payload=JSON.parse($('payload').value);if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error();if(!['list','billing_list'].includes(action)&&!window.confirm('Potvrdite administratorsku izmenu.'))return;$('data').textContent=JSON.stringify(await c.call(action,payload),null,2);});};
state('login');
