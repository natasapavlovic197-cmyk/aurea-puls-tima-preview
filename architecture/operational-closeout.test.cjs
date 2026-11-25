'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createAdminConsole}=require('./activation-candidate/admin-console.cjs');
const {createProductionPublicConfig}=require('./postgrest-runtime/production-public-config.cjs');
const {ORIGIN}=require('./activation-candidate/policy.cjs');
test('first operator enrollment is explicit; no API before AAL2; secret never transmitted to admin handler',async()=>{
 let level='aal1',all=[],enrolls=0,requests=0;const ok=data=>({data,error:null});
 const client={auth:{signInWithPassword:async()=>ok({}),signOut:async()=>ok({}),getSession:async()=>ok({session:{access_token:'fixture.token.value'}}),mfa:{
 getAuthenticatorAssuranceLevel:async()=>ok({currentLevel:level}),listFactors:async()=>ok({all,totp:all}),
 enroll:async()=>{enrolls++;all=[{id:'fixture-factor',status:'unverified'}];return ok({id:'fixture-factor',type:'totp',totp:{secret:'ABCDEFGHIJKLMNOP234567'}});},
 challengeAndVerify:async({factorId,code})=>{assert.equal(factorId,'fixture-factor');assert.equal(code,'123456');level='aal2';all[0].status='verified';return ok({});}}}};
 const c=createAdminConsole({key:createProductionPublicConfig({environment:'production'}).key,endpoint:ORIGIN+'/.netlify/functions/aurea-admin',createClient:(_u,_k,o)=>{assert.equal(o.auth.persistSession,false);return client},fetchImpl:async(_u,o)=>{requests++;assert.equal(JSON.parse(o.body).action,'list');assert.ok(!o.body.includes('ABCDEFGHIJKLMNOP'));return new Response('[]',{status:200})}});
 assert.deepEqual(await c.signIn('operator@example.invalid','fixture'),{status:'enrollment_required'});assert.equal(enrolls,0);await assert.rejects(()=>c.call('list'),/MFA/);const e=await c.enroll();assert.equal(e.factorId,'fixture-factor');assert.equal(enrolls,1);await assert.rejects(()=>c.enroll(),/unavailable/);await assert.rejects(()=>c.call('list'),/MFA/);assert.equal(requests,0);await c.verify(e.factorId,'123456');assert.deepEqual(await c.call('list'),[]);assert.equal(requests,1);
});
test('actual endpoint config has exact path, method and per-IP rate limits; default disabled handlers make no calls',async()=>{
 let calls=0;const old=globalThis.fetch;globalThis.fetch=async()=>{calls++;throw Error('external request')};try{
 const bg=await import('./activation-candidate/netlify-functions/aurea-job-background.mjs'),ad=await import('./activation-candidate/netlify-functions/aurea-admin.mjs');
 assert.equal(bg.config.background,true);assert.equal(bg.config.path,'/.netlify/functions/aurea-job-background');assert.equal(bg.config.method,'POST');assert.deepEqual(bg.config.rateLimit,{windowLimit:6,windowSize:60,aggregateBy:['ip','domain']});
 assert.equal(ad.config.path,'/.netlify/functions/aurea-admin');assert.deepEqual(ad.config.method,['POST','OPTIONS']);assert.deepEqual(ad.config.rateLimit,{windowLimit:30,windowSize:60,aggregateBy:['ip','domain']});
 await bg.default(new Request('https://example.invalid',{method:'POST'}));assert.equal((await ad.default(new Request('https://example.invalid',{method:'POST'}))).status,503);assert.equal(calls,0);
 }finally{globalThis.fetch=old;}
});
