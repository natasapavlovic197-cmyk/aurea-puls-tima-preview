'use strict';
// Netlify manager entrypoint. Explicit deployment approval + restricted PG
// credentials are mandatory. No service_role and no fallback to memory limits.
const {createStagingManagerService}=require('../../architecture/staging-manager-service.cjs');
const {managerDeploymentPreflight}=require('../../architecture/manager-deployment-preflight.cjs');
const deny=()=>({statusCode:503,headers:{'content-type':'application/json','cache-control':'no-store'},body:JSON.stringify({status:'unavailable'})});
function createHandler({env=process.env,loadPool=()=>require('pg').Pool,fetchImpl=globalThis.fetch}={}){
 let service;
 return async function handler(event){
  if(env.AUREA_B2B_MANAGER_ENABLED!=='true'||env.AUREA_B2B_MANAGER_DEPLOY_APPROVED!=='true')return deny();
  try{
   if(!service){
    const Pool=loadPool();
    if(!managerDeploymentPreflight({env,driverAvailable:typeof Pool==='function'}).ready)return deny();
    service=createStagingManagerService({env,Pool,fetchImpl});
   }
   return await service.handler(event);
  }catch{return deny()}
 };
}
exports.handler=createHandler();
exports.createHandler=createHandler;
