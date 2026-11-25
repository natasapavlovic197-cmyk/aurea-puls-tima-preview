'use strict';
const {verifyPublic,verifyBrowser,assertActive}=require('./postgrest-runtime/production-runtime-gate.cjs');
const {mountManagerLogin}=require('./manager-login-view.js');
const {createManagerSignIn}=require('./manager-auth-provider.cjs');
const {openAuthenticatedManager}=require('./manager-authenticated-entry.cjs');
function bootManagerLogin({root,createClient,url,key,endpoint,fetchImpl}={}){
 verifyPublic({url,key});assertActive();
 if(!root||typeof createClient!=='function'||typeof key!=='string'||!key.startsWith('sb_publishable_'))throw TypeError('Invalid production configuration');
 const parsed=new URL(url);
 if(parsed.protocol!=='https:'||parsed.hostname!=='dlibifwlmbfkboerlmqd.supabase.co'||parsed.username||parsed.password||parsed.pathname!=='/'||parsed.search||parsed.hash)throw TypeError('Invalid API URL');
 const client=createClient(parsed.origin,key,{auth:{persistSession:false,autoRefreshToken:true,detectSessionInUrl:false}});
 return mountManagerLogin(root,{signIn:createManagerSignIn(client),openWorkspace:(host,provider)=>openAuthenticatedManager({root:host,provider,url,key,endpoint,fetchImpl})});
}
module.exports={bootManagerLogin};
