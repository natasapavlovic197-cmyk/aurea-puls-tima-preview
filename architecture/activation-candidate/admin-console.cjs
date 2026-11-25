'use strict';
// Authenticated console client, separate from public static site. Never persist tokens.
const {API}=require('./policy.cjs');
function createAdminConsole({createClient,key,endpoint,fetchImpl=globalThis.fetch}){
 if(typeof createClient!=='function'||key!=='sb_publishable_XFEcctH-xzU6X6ABeIu7mw_IUWVmUhD'||endpoint!=='https://puls.aureapsihoterapija.com/.netlify/functions/aurea-admin')throw Error('Invalid admin configuration');
 const client=createClient(API,key,{auth:{persistSession:false,autoRefreshToken:true,detectSessionInUrl:false}});
 const ensure=r=>{if(r.error)throw Error('Admin authentication denied');return r.data;};
 return Object.freeze({async signIn(email,password){ensure(await client.auth.signInWithPassword({email,password}));const a=ensure(await client.auth.mfa.getAuthenticatorAssuranceLevel());if(a.currentLevel==='aal2')return {status:'ready'};const f=ensure(await client.auth.mfa.listFactors()).totp.filter(x=>x.status==='verified');if(f.length!==1){await client.auth.signOut({scope:'local'});throw Error('Exactly one pre-enrolled TOTP factor required');}return {status:'challenge',factorId:f[0].id};},
 async verify(factorId,code){if(!/^\d{6}$/.test(code))throw Error('Invalid code');ensure(await client.auth.mfa.challengeAndVerify({factorId,code}));const a=ensure(await client.auth.mfa.getAuthenticatorAssuranceLevel());if(a.currentLevel!=='aal2')throw Error('MFA required');return {status:'ready'};},
 async call(action,payload={}){const a=ensure(await client.auth.mfa.getAuthenticatorAssuranceLevel());if(a.currentLevel!=='aal2')throw Error('MFA required');const session=ensure(await client.auth.getSession()).session;if(!session?.access_token)throw Error('No session');const r=await fetchImpl(endpoint,{method:'POST',headers:{apikey:key,authorization:'Bearer '+session.access_token,'content-type':'application/json'},body:JSON.stringify({action,payload}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Request denied');return r.json();},
 async signOut(){ensure(await client.auth.signOut({scope:'local'}));}});
}
module.exports={createAdminConsole};
