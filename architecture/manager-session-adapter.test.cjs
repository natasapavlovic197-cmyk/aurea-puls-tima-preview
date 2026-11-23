'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createSessionAdapter}=require('./manager-session-adapter.cjs');
test('reads current token and invalidates on sign-out',async()=>{
 let token='first',notify,called=0;
 const session=createSessionAdapter({readSession:async()=>({access_token:token}),subscribe:fn=>{notify=fn;return ()=>{}},signOut:async()=>{}});
 assert.equal(await session.getAccessToken(),'first');token='second';assert.equal(await session.getAccessToken(),'second');
 session.onSignOut(()=>called++);notify('SIGNED_OUT');assert.equal(await session.getAccessToken(),null);assert.equal(called,1);
});
test('sign-out during pending token read cannot return token',async()=>{
 let resolve;const session=createSessionAdapter({readSession:()=>new Promise(r=>resolve=r),subscribe:()=>()=>{},signOut:async()=>{}});
 const pending=session.getAccessToken();await session.signOut();resolve({access_token:'old'});assert.equal(await pending,null);
});
test('local session closes even when remote sign-out fails',async()=>{
 const session=createSessionAdapter({readSession:async()=>({access_token:'old'}),subscribe:()=>()=>{},signOut:async()=>{throw Error('offline')}});
 await assert.rejects(session.signOut());assert.equal(await session.getAccessToken(),null);
});
