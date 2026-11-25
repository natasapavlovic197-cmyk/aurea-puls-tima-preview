'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomBytes}=require('node:crypto'),{start}=require('./admin-transport-qa.cjs');
test('protected transport, persistence across restart, tenant isolation',async()=>{
 const token=randomBytes(32).toString('hex');let s;
 const open=async()=>{s=await start({token,db:'aurea_admin_fixture'});return 'http://127.0.0.1:'+s.address().port};
 const close=()=>new Promise((r,j)=>s.close(e=>e?j(e):r()));
 let base=await open();
 const call=(path,data,t=token,origin=base)=>fetch(base+path,{method:data?'POST':'GET',headers:{Authorization:'Bearer '+t,...(data?{'Content-Type':'application/json',Origin:origin}:{})},...(data?{body:JSON.stringify(data)}:{})});
 try{
  assert.equal((await call('/api/accounts',undefined,'bad')).status,401);
  assert.equal((await call('/api/register',{name:'Denied',seats:5,plan:'monthly'},token,'https://invalid.example')).status,403);
  const html=await (await fetch(base)).text();assert.match(html,/QA pristupni token/);assert.match(html,/fetch\('\/api\//);
  const a=await call('/api/register',{name:"QA A ' special",seats:50,plan:'annual'});assert.equal(a.status,201);const {id}=await a.json();
  const b=await call('/api/register',{name:'QA B',seats:5,plan:'gift'});assert.equal(b.status,201);const bid=(await b.json()).id;
  assert.equal((await call('/api/change',{id,operation:'seats',value:75})).status,200);
  assert.equal((await call('/api/change',{id:bid,operation:'renewal',value:true})).status,400);
  await close();base=await open();
  const list=await (await call('/api/accounts')).json();
  assert.equal(list.length,2);assert.equal(list.find(x=>x.organization_id===id).seats,75);assert.equal(list.find(x=>x.organization_id===bid).status,'complimentary');
 }finally{if(s?.listening)await close()}
});
