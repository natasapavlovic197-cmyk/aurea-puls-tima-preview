'use strict';
const ORIGIN='https://puls.aureapsihoterapija.com';
const API='https://dlibifwlmbfkboerlmqd.supabase.co';
const ROUTES=Object.freeze({manager:'/puls-app/rukovodilac/',employee:'/puls-app/zaposleni/',education:'/puls-app/edukacija/'});
const FLAGS=Object.freeze({manager:'AUREA_ENABLE_MANAGER',employee:'AUREA_ENABLE_EMPLOYEE',adminRead:'AUREA_ENABLE_ADMIN_READ',adminWrite:'AUREA_ENABLE_ADMIN_WRITE',billingWrite:'AUREA_ENABLE_BILLING_WRITE',scheduler:'AUREA_ENABLE_SCHEDULER',delivery:'AUREA_ENABLE_DELIVERY'});
function policy(env={}){
 const valid=env.AUREA_ENVIRONMENT==='production'&&env.AUREA_SUPABASE_URL===API&&env.AUREA_ACTIVATION_APPROVAL==='approved-production-activation-v1';
 return Object.freeze(Object.fromEntries(Object.entries(FLAGS).map(([role,key])=>[role,valid&&env[key]==='true'])));
}
function requireRole(role,env){if(!Object.hasOwn(FLAGS,role)||!policy(env)[role])throw Error('Activation denied');}
function link(role,token){
 if(role==='employee'){
  if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))throw Error('Invalid capability');
  return ORIGIN+ROUTES.employee+'#'+token;
 }
 if(token!==undefined||!['manager','education'].includes(role))throw Error('Invalid route');
 return ORIGIN+ROUTES[role];
}
module.exports={ORIGIN,API,ROUTES,FLAGS,policy,requireRole,link};
