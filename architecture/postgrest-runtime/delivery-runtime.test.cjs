'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {preparePostgrestDeliveryRuntime}=require('./delivery-runtime.cjs');
const env={AUREA_SUPABASE_URL:'https://ublzmoroanhlcgpnxilw.supabase.co',AUREA_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_synthetic',AUREA_DELIVERY_AUTH_USER_ID:'11111111-1111-4111-8111-111111111111',AUREA_INVITATION_HMAC_SECRET:'ab'.repeat(32)};
function fixture(patch={}){
 let requests=0,reads=0;
 const options={env:{...env,...patch},readCredentials:async()=>{reads++;throw Error('Unexpected credential access')},fetchImpl:async()=>{requests++;throw Error('Unexpected network')},clock:()=>1000000,origin:'https://example.invalid'};
 return {options,counts:()=>[requests,reads]};
}
test('composed real worker remains disabled without credentials or network',async()=>{
 const f=fixture(),r=preparePostgrestDeliveryRuntime(f.options);
 assert.deepEqual(Object.keys(r).sort(),['close','processNext']);
 assert.deepEqual(await r.processNext(),{status:'disabled'});
 await r.close();
 assert.deepEqual(await r.processNext(),{status:'disabled'});
 assert.deepEqual(f.counts(),[0,0]);
});
test('activation flags rejected before credential or network access',()=>{
 for(const patch of [{AUREA_DELIVERY_ENABLED:'true'},{AUREA_DELIVERY_DEPLOY_APPROVED:'true'}]){
 const f=fixture(patch);assert.throws(()=>preparePostgrestDeliveryRuntime(f.options),/activation not approved/);assert.deepEqual(f.counts(),[0,0]);
 }
});
test('missing server credential reader rejected',()=>{
 const f=fixture();assert.throws(()=>preparePostgrestDeliveryRuntime({...f.options,readCredentials:undefined}),/credential reader required/);assert.deepEqual(f.counts(),[0,0]);
});
test('invalid transport rejected without falling back to global fetch',()=>{
 const f=fixture();assert.throws(()=>preparePostgrestDeliveryRuntime({...f.options,fetchImpl:null}),/Invalid server Auth configuration/);assert.deepEqual(f.counts(),[0,0]);
});
