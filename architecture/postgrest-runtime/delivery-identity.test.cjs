'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const {createDeliverySession,readServerConfig}=require('./delivery-identity.cjs');
const id='11111111-1111-4111-8111-111111111111';
const env={AUREA_SUPABASE_URL:'https://ublzmoroanhlcgpnxilw.supabase.co',AUREA_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_synthetic',AUREA_DELIVERY_AUTH_USER_ID:id,AUREA_INVITATION_HMAC_SECRET:'ab'.repeat(32)};
function fixture(){
 let now=1000000,signs=0,refreshes=0,revokes=0;
 const auth={async signIn(){signs++;return {accessToken:'fake.initial.token',refreshToken:'synthetic-one',expiresAt:now+120000,userId:id}},async refresh(t){assert.equal(t,'synthetic-one');refreshes++;return {accessToken:'fake.rotated.token',refreshToken:'synthetic-two',expiresAt:now+120000,userId:id}},async getUser(){return {id}},async signOut(){revokes++}};
 return {auth,clock:()=>now,advance:()=>{now+=70000},counts:()=>[signs,refreshes,revokes]};
}
test('server config rejects wrong project, privileged key, missing HMAC, shared HMAC and activation',()=>{
 assert.equal(readServerConfig(env).identityId,id);
 for(const patch of [{AUREA_SUPABASE_URL:'https://wrong.supabase.co'},{AUREA_SUPABASE_PUBLISHABLE_KEY:'sb_secret_fake'},{AUREA_INVITATION_HMAC_SECRET:''},{AUREA_LIMITER_SECRET:env.AUREA_INVITATION_HMAC_SECRET},{AUREA_DELIVERY_ENABLED:'true'},{AUREA_DELIVERY_DEPLOY_APPROVED:'true'}])assert.throws(()=>readServerConfig({...env,...patch}));
});
test('concurrent read single sign-in and single refresh, then revoke',async()=>{
 const f=fixture(),s=createDeliverySession({...f,identityId:id});
 assert.deepEqual(await Promise.all([s.readToken(),s.readToken()]),['fake.initial.token','fake.initial.token']);
 f.advance();assert.deepEqual(await Promise.all([s.readToken(),s.readToken()]),['fake.rotated.token','fake.rotated.token']);
 await s.close();await assert.rejects(s.readToken());assert.deepEqual(f.counts(),[1,1,1]);
});
test('wrong provider identity fails closed without leaking diagnostics',async()=>{
 const f=fixture();f.auth.getUser=async()=>({id:'other'});
 const s=createDeliverySession({...f,identityId:id});await assert.rejects(s.readToken(),/session disabled/);await assert.rejects(s.readToken(),/closed/);
});
test('refresh failure closes session rather than signing in again',async()=>{
 const f=fixture();f.auth.refresh=async()=>{throw Error('private diagnostic')};
 const s=createDeliverySession({...f,identityId:id});await s.readToken();f.advance();await assert.rejects(s.readToken(),/session disabled/);await assert.rejects(s.readToken(),/closed/);assert.equal(f.counts()[0],1);
});
test('revocation failure is not reported as success',async()=>{
 const f=fixture();f.auth.signOut=async()=>{throw Error('private diagnostic')};
 const s=createDeliverySession({...f,identityId:id});await s.readToken();await assert.rejects(s.close(),/revocation unconfirmed/);await assert.rejects(s.readToken());
});

test('close during refresh revokes rotated token once and rejects waiting readers',async()=>{
 const f=fixture(),s=createDeliverySession({...f,identityId:id});
 await s.readToken();f.advance();
 let release;const gate=new Promise(r=>{release=r});const revoked=[];
 f.auth.refresh=async()=>{await gate;return {accessToken:'fake.rotated.token',refreshToken:'synthetic-two',expiresAt:f.clock()+120000,userId:id}};
 f.auth.signOut=async t=>{revoked.push(t)};
 const read=s.readToken();const rejection=assert.rejects(read,/session disabled/);
 const first=s.close(),second=s.close();assert.equal(first,second);
 release();await rejection;await Promise.all([first,second]);
 assert.deepEqual(revoked,['fake.rotated.token']);await assert.rejects(s.readToken(),/closed/);
});
test('close during initial authentication revokes newly issued verified token',async()=>{
 const f=fixture();let release;const gate=new Promise(r=>{release=r});const revoked=[];
 const original=f.auth.signIn;f.auth.signIn=async()=>{await gate;return original()};
 f.auth.signOut=async t=>{revoked.push(t)};
 const s=createDeliverySession({...f,identityId:id});const read=s.readToken();const rejection=assert.rejects(read,/session disabled/);
 const closing=s.close();release();await rejection;await closing;
 assert.deepEqual(revoked,['fake.initial.token']);
});
test('parallel close callers share revocation failure',async()=>{
 const f=fixture();let calls=0;f.auth.signOut=async()=>{calls++;throw Error('private')};
 const s=createDeliverySession({...f,identityId:id});await s.readToken();
 const a=s.close(),b=s.close();assert.equal(a,b);await Promise.all([assert.rejects(a,/revocation unconfirmed/),assert.rejects(b,/revocation unconfirmed/)]);assert.equal(calls,1);
});
