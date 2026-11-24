'use strict';
// Server-only reader. Never import into browser code or expose through an HTTP handler.
function createDeliveryCredentialReader(env=process.env){
 if(typeof window!=='undefined')throw Error('Server only');
 return async function readCredentials(){
  const email=env.AUREA_DELIVERY_AUTH_EMAIL,password=env.AUREA_DELIVERY_AUTH_PASSWORD;
  if(env.AUREA_DELIVERY_AUTH_USER_ID!=='3070286d-a61b-43f2-8d2b-d3c0461bf54c'||email!=='aurea-delivery-staging@example.invalid'||typeof password!=='string'||password.length<20||password.length>1024)throw Error('Invalid staging delivery credentials');
  return {email,password};
 };
}
module.exports={createDeliveryCredentialReader};
