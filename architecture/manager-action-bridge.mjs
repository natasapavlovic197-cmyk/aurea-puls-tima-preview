/**
 * Explicit manager action bridge. Does not touch DOM, Netlify, or employee data.
 * A preview is always read-only. Persistence requires a separate commit call
 * from an authenticated, tenant-scoped managerClient.
 */
import decisionModule from './manager-decision-workflow.cjs';
const {prepareManagerDecision}=decisionModule;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function previewManagerAction(recommendation,choice){
 return prepareManagerDecision(recommendation,choice);
}
export async function commitManagerAction(manager,prepared,{cycleId=null}={}){
 if(!manager||typeof manager.saveAction!=='function')throw TypeError('Authenticated manager adapter required');
 if(!prepared||prepared.persist!==true||!['accept','edit'].includes(prepared.decision)||
  !prepared.action||prepared.action.status!=='open'||
  typeof prepared.action.description!=='string'||prepared.action.description.trim().length<8||
  prepared.action.description.length>600||
  !prepared.source||typeof prepared.source.domain!=='string'||
  typeof prepared.source.itemCode!=='string'||!Number.isInteger(prepared.source.itemVersion)||
  prepared.source.itemVersion<1)throw TypeError('Unapproved or invalid action');
 if(cycleId!==null&&(typeof cycleId!=='string'||!UUID.test(cycleId)))throw TypeError('Invalid cycle');
 // No implicit action update, no employee-level payload, no hidden retry.
 return manager.saveAction({
  description:prepared.action.description,
  dueOn:prepared.action.dueOn,
  cycleId,
  status:'open'
 });
}
