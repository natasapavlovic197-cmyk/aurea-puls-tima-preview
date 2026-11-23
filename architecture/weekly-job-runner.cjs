'use strict';
// Dispatch boundary: all weekly jobs remain dry-run until a separately approved
// durable delivery service is configured. No email is sent by this module.
const {planJob}=require('./weekly-orchestrator.cjs');
const ACTIONS=new Set(['invite','reminder','report']);
async function runWeeklyJob({instant,tenantId,weekStart,alreadyRun=[],hour=9,delivery,enabled=false}={}){
 const job=planJob({instant,tenantId,weekStart,alreadyRun,hour});
 if(!job)return Object.freeze({status:'outside_schedule'});
 if(!job.shouldRun)return Object.freeze({status:'already_processed',key:job.key});
 if(!enabled)return Object.freeze({status:'dry_run',key:job.key,action:job.action});
 if(!delivery||typeof delivery.reserve!=='function'||typeof delivery.dispatch!=='function')throw Error('Durable delivery boundary required');
 if(!ACTIONS.has(job.action))throw Error('Unexpected action');
 // Atomic reservation must be durable and unique on job.key across processes.
 const reserved=await delivery.reserve(job.key,{tenantId,weekStart,action:job.action});
 if(reserved!==true)return Object.freeze({status:'already_processed',key:job.key});
 // On dispatch failure the durable delivery service must own retry and reconciliation.
 await delivery.dispatch({key:job.key,tenantId,weekStart,action:job.action});
 return Object.freeze({status:'dispatched',key:job.key,action:job.action});
}
module.exports={runWeeklyJob};
