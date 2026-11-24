'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createSupabaseDeliveryAuth}=require('./delivery-supabase-auth.cjs');
const id='11111111-1111-4111-8111-111111111111';
const base='https://ublzmoroanhlcgpnxilw.supabase.co';
const credentials={email:'fixture@example.invalid',password:'synthetic-only-password'};
const payload={access_token:'fake.access.token',refresh_token:'fake-refresh',expires_in:3600,token_type:'bearer',user:{id}};
function fixture(responses=[]){
 const calls=[];const options={url:base,key:'sb_publishable_synthetic',identityId:id,clock:()=>1000000,readCredentials:async()=>credentials,fetchImpl:async(url,opts)=>{calls.push({url,...opts});assert.ok(responses.length);const v=responses.shift();if(v instanceof Error)throw v;return v;}};
 return {calls,options,auth:createSupabaseDeliveryAuth(options)};
}
const json=(v,status=200)=>Response.json(v,{status});
test('sign-in maps provider session and uses fixed secure POST',async()=>{const f=fixture([json(payload)]);assert.deepEqual(await f.auth.signIn(),{accessToken:'fake.access.token',refreshToken:'fake-refresh',expiresAt:4600000,userId:id});const c=f.calls[0];assert.equal(c.url,base+'/auth/v1/token?grant_type=password');assert.equal(c.method,'POST');assert.deepEqual(JSON.parse(c.body),credentials);assert.equal(c.redirect,'error');assert.equal(c.cache,'no-store');assert.equal(c.credentials,'omit');assert.ok(c.signal instanceof AbortSignal);assert.equal(c.headers.apikey,'sb_publishable_synthetic');});
test('refresh rotates token without re-reading credentials',async()=>{const f=fixture([json({...payload,refresh_token:'new-refresh'})]);assert.equal((await f.auth.refresh('old-refresh')).refreshToken,'new-refresh');assert.equal(f.calls[0].url,base+'/auth/v1/token?grant_type=refresh_token');assert.deepEqual(JSON.parse(f.calls[0].body),{refresh_token:'old-refresh'});});
test('getUser verifies identity with bearer and GET',async()=>{const f=fixture([json({id})]);assert.deepEqual(await f.auth.getUser('fake.access.token'),{id});assert.equal(f.calls[0].method,'GET');assert.equal(f.calls[0].headers.authorization,'Bearer fake.access.token');assert.equal(f.calls[0].body,undefined);});
test('local logout accepts empty 204',async()=>{const f=fixture([new Response(null,{status:204})]);await f.auth.signOut('fake.access.token');assert.equal(f.calls[0].url,base+'/auth/v1/logout?scope=local');assert.equal(f.calls[0].headers.authorization,'Bearer fake.access.token');});
test('wrong project and privileged key rejected before HTTP',()=>{const f=fixture();for(const patch of [{url:'https://other.supabase.co'},{key:'sb_secret_fake'},{identityId:'wrong'}])assert.throws(()=>createSupabaseDeliveryAuth({...f.options,...patch}));assert.equal(f.calls.length,0);});
test('wrong identity, anonymous identity and malformed expiry rejected',async()=>{for(const patch of [{user:{id:'wrong'}},{user:{id,is_anonymous:true}},{expires_in:60},{expires_in:'3600'},{access_token:'invalid'},{refresh_token:'invalid token'}]){const f=fixture([json({...payload,...patch})]);await assert.rejects(f.auth.signIn(),/^Error: Delivery Auth sign-in failed$/);}});
test('provider mismatch on getUser rejected',async()=>{const f=fixture([json({id:'wrong'})]);await assert.rejects(f.auth.getUser('fake.access.token'),/identity mismatch/);});
test('network and HTTP failure sanitized, no retry',async()=>{for(const r of [new Error('private diagnostic'),json({message:'private diagnostic'},401),json({message:'private diagnostic'},429)]){const f=fixture([r]);await assert.rejects(f.auth.signIn(),/^Error: Delivery Auth sign-in failed$/);assert.equal(f.calls.length,1);}});
test('bad refresh and bearer inputs never sent',async()=>{const f=fixture();await assert.rejects(f.auth.refresh('invalid token'));await assert.rejects(f.auth.getUser('invalid'));await assert.rejects(f.auth.signOut('invalid'));assert.equal(f.calls.length,0);});
test('failed logout is not reported as success',async()=>{const f=fixture([json({message:'private diagnostic'},500)]);await assert.rejects(f.auth.signOut('fake.access.token'),/^Error: Delivery Auth request failed$/);});
test('invalid credentials rejected before network',async()=>{const f=fixture();const auth=createSupabaseDeliveryAuth({...f.options,readCredentials:async()=>({email:'bad',password:'bad'})});await assert.rejects(auth.signIn());assert.equal(f.calls.length,0);});
