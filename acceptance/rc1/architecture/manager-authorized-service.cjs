'use strict';
const {buildPublishedManagerReport}=require('./published-manager-report.cjs');
function createAuthorizedManagerService({bridge}={}){
 if(!bridge||['authenticate','readAuthorizedPublications','readActions','saveAction'].some(k=>typeof bridge[k]!=='function'))throw new TypeError('Missing manager bridge');
 async function identity(event,organizationId){
  if(typeof organizationId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(organizationId))throw new TypeError('Invalid organization');
  const user=await bridge.authenticate(event);
  if(!user?.id||!user?.token)throw new Error('Unauthorized');
  return {token:user.token,organizationId};
 }
 async function overview(event,organizationId){
  const scope=await identity(event,organizationId);
  const [rows,activities]=await Promise.all([bridge.readAuthorizedPublications(scope),bridge.readActions(scope)]);
  return {report:buildPublishedManagerReport(rows),activities};
 }
 async function save(event,organizationId,input){
  const scope=await identity(event,organizationId);
  if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Invalid activity');
  const {description,dueOn,cycleId,actionId,status}=input;
  return {id:await bridge.saveAction({...scope,description,dueOn,cycleId,actionId,status})};
 }
 return Object.freeze({overview,save});
}
module.exports={createAuthorizedManagerService};
