'use strict';
const {policy}=require('./policy.cjs');
const {belgradeParts}=require('../weekly-orchestrator.cjs');
// Invocation-only composition: no timer registration or public HTTP handler.
async function run({kind,env={},clock=()=>new Date(),createSession,schedule,processNext}={}){
 if(!['scheduler','delivery'].includes(kind))throw Error('Unknown job');
 if(!policy(env)[kind])return {status:'disabled'};
 if(typeof createSession!=='function')throw Error('Missing scoped session');
 const p=belgradeParts(clock());
 // UTC host can invoke hourly; only Belgrade 09:00 Monday/Wednesday/Friday opens scheduler.
 if(kind==='scheduler'&&(!['monday','wednesday','friday'].includes(p.day)||p.hour!==9))return {status:'outside_schedule'};
 const session=await createSession();
 try{
  if(typeof session?.readToken!=='function'||typeof session?.close!=='function')throw Error('Invalid session');
  if(kind==='scheduler'){if(typeof schedule!=='function')throw Error('Scheduler missing');return await schedule(session);}
  if(typeof processNext!=='function')throw Error('Worker missing');
  // One claimed job per invocation; never loop or retry unknown outcomes.
  return await processNext(session);
 }finally{if(typeof session?.close==='function')await session.close();}
}
module.exports={run};
