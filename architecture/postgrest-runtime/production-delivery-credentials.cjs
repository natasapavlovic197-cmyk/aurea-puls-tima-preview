'use strict';
const {verifyPublic,verifyBrowser,assertActive}=require('./production-runtime-gate.cjs');
// Server-only reader. Never import into browser code or expose through an HTTP handler.
function createDeliveryCredentialReader(env=process.env){
 if(typeof window!=='undefined')throw Error('Server only');
 assertActive();
 return async function readCredentials(){
  const email=env.AUREA_DELIVERY_AUTH_EMAIL,password=env.AUREA_DELIVERY_AUTH_PASSWORD;
  if(env.AUREA_ENVIRONMENT!=='production'||!(/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(env.AUREA_DELIVERY_AUTH_USER_ID||''))||env.AUREA_DELIVERY_AUTH_USER_ID.toLowerCase()==='3070286d-a61b-43f2-8d2b-d3c0461bf54c'||typeof email!=='string'||email.toLowerCase()==='aurea-delivery-staging@example.invalid'||!(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))||typeof password!=='string'||password.length<20||password.length>1024)throw Error('Invalid production delivery credentials');
  return {email,password};
 };
}
module.exports={createDeliveryCredentialReader};
