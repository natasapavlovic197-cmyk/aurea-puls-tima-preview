'use strict';
// Opt-in, employee-owned portable encrypted history. No localStorage, cookies,
// network calls, invitation tokens, identity or organization identifiers.
const {anchors,rotation,domains}=require('./psychometric-item-bank.cjs');
const bank=new Map([...anchors,...rotation.flat()].map(q=>[q.code,q]));
const MAX=104;
function normalize(records){
 if(!Array.isArray(records)||records.length>MAX)throw Error('Invalid history');
 const seen=new Set();
 return records.map(r=>{
 if(!r||typeof r.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!Number.isFinite(Date.parse(r.date))||new Date(r.date).toISOString().slice(0,10)!==r.date||seen.has(r.date)||!Array.isArray(r.items)||r.items.length!==6)throw Error('Invalid record');
 seen.add(r.date);const codes=new Set();
 const items=r.items.map(x=>{const q=bank.get(x?.code);if(!q||codes.has(x.code)||x.wording!==q.text||(x.rating!==null&&(!Number.isInteger(x.rating)||x.rating<1||x.rating>5)))throw Error('Invalid item');codes.add(x.code);return {code:x.code,wording:q.text,rating:x.rating};});
 return {date:r.date,items};
 }).sort((a,b)=>a.date.localeCompare(b.date));
}
function append(records,rows,date){
 const existing=normalize(records);
 if(existing.some(r=>r.date===date))throw Error('Date already recorded');
 return normalize([...existing,{date,items:rows.map(x=>({code:x.code,wording:bank.get(x.code)?.text,rating:x.rating}))}]);
}
function series(records,code){
 if(!bank.has(code))throw Error('Unknown item');
 return normalize(records).map(r=>({date:r.date,rating:r.items.find(x=>x.code===code)?.rating??null}));
}
function coverage(records){const measured=new Set(normalize(records).flatMap(r=>r.items.filter(x=>x.rating!==null).map(x=>bank.get(x.code).domain)));return domains.filter(d=>measured.has(d));}
const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
function bytes(s,n){if(typeof s!=='string'||s.length!==n*2||!/^[0-9a-f]+$/.test(s))throw Error('Invalid archive');return Uint8Array.from(s.match(/../g),x=>parseInt(x,16))}
async function key(crypto,password,salt){
 if(typeof password!=='string'||password.length<12||password.length>256)throw Error('Use a passphrase of at least 12 characters');
 const material=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:600000},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
const aad=enc.encode('AUREA personal history v1');
async function seal(records,password,crypto=globalThis.crypto){
 const clean=normalize(records),salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
 const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},await key(crypto,password,salt),enc.encode(JSON.stringify(clean)));
 return JSON.stringify({format:'aurea-personal-v1',salt:hex(salt),iv:hex(iv),ciphertext:hex(new Uint8Array(ciphertext))});
}
async function open(archive,password,crypto=globalThis.crypto){
 if(typeof archive!=='string'||archive.length>1000000)throw Error('Invalid archive');
 const a=JSON.parse(archive);if(!a||a.format!=='aurea-personal-v1'||typeof a.ciphertext!=='string'||a.ciphertext.length<32||a.ciphertext.length%2)throw Error('Invalid archive');
 const salt=bytes(a.salt,16),iv=bytes(a.iv,12),ciphertext=bytes(a.ciphertext,a.ciphertext.length/2);
 const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad},await key(crypto,password,salt),ciphertext);
 return normalize(JSON.parse(dec.decode(plain)));
}
module.exports={normalize,append,series,coverage,seal,open};
