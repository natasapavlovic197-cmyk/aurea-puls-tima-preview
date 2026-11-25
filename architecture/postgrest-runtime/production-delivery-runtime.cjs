'use strict';
const {verifyPublic,verifyBrowser,assertActive}=require('./production-runtime-gate.cjs');
const {readServerConfig,prepareDeliveryIdentity}=require('./production-delivery-identity.cjs');
const {createDeliveryCredentialReader}=require('./production-delivery-credentials.cjs');
const {createSupabaseDeliveryAuth}=require('./production-delivery-supabase-auth.cjs');
// Server-only composition. No scheduler registration, provider, or activation path.
function preparePostgrestDeliveryRuntime({env=process.env,readCredentials=createDeliveryCredentialReader(env),fetchImpl=globalThis.fetch,clock=Date.now,origin}={}){
 assertActive();
 const c=readServerConfig(env);
 if(typeof readCredentials!=='function')throw Error('Server credential reader required');
 const auth=createSupabaseDeliveryAuth({url:c.url,key:c.key,identityId:c.identityId,readCredentials,fetchImpl,clock});
 return prepareDeliveryIdentity({env,auth,clock,origin,fetchImpl});
}
module.exports={preparePostgrestDeliveryRuntime};
