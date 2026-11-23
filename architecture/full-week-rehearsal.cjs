'use strict';
// In-memory end-to-end contract rehearsal. No live users, DB writes, or notifications.
const {StagingEngine}=require('./staging-engine.cjs');
const {buildReport}=require('./report-release.cjs');
const {createPulseSubmitHandler}=require('./pulse-submit-boundary.cjs');
const {createManagerSummaryHandler}=require('./manager-summary-boundary.cjs');
const UUIDS=['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004'];
const DOMAINS=['clarity','trust','workload','communication'];
const ORGS={A:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'};
async function rehearse(){
 const engine=new StagingEngine(),week='2026-11-23',now=Date.UTC(2026,10,23,8);
 Object.values(ORGS).forEach(id=>engine.addTenant(id));
 const issued={};
 for(const [name,org] of Object.entries(ORGS))issued[name]=Array.from({length:6},(_,i)=>engine.issueInvite({tenant:org,week,employee:name+i,now}));
 const runs=[];
 for(const [name,org] of Object.entries(ORGS)){
  runs.push(engine.schedule({tenant:org,week,day:'Monday',now}));
 }
 const submit=createPulseSubmitHandler({
  rateLimit:async()=>true,
  adapter:{submitPulse:async(token,answers)=>{
   const org=Object.values(ORGS).find(id=>issued[Object.keys(ORGS).find(k=>ORGS[k]===id)].includes(token));
   if(!org||!engine.redeemBatch({token,tenant:org,week,now:now+3600000,answers:answers.map(a=>({domain:DOMAINS[UUIDS.indexOf(a.question_id)],value:a.rating}))}))throw Error('invalid invitation');
  }}
 });
 const submission={};
 for(const [name,tokens] of Object.entries(issued)){
  submission[name]=[];
  const n=name==='A'?5:4; // Company B must remain suppressed (<5 responses)
  for(let i=0;i<n;i++){
   const answers=UUIDS.map((question_id,j)=>({question_id,rating:j===2?2:4+(i%2)}));
   submission[name].push(await submit({httpMethod:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token:tokens[i],answers})}));
  }
 }
 const replay=await submit({httpMethod:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token:issued.A[0],answers:UUIDS.map(question_id=>({question_id,rating:1}))})});
 const reminders={};
 for(const [name,org] of Object.entries(ORGS))reminders[name]=engine.schedule({tenant:org,week,day:'Wednesday',now:now+2*86400000});
 const published=new Map();
 for(const org of Object.values(ORGS)){
  const domains=Object.fromEntries(DOMAINS.map(domain=>[domain,engine.answers.filter(a=>a.tenant===org&&a.week===week&&a.domain===domain).map(a=>a.value)]));
  const release=buildReport({tenant:org,week,teamSize:6,domains,cycleClosed:true});
  if(release?.status==='ready')published.set(org,{organizationId:org,week,domains:release.report.domains,immutable:true,privacyApproved:true});
 }
 const summary=createManagerSummaryHandler({
  rateLimit:async()=>true,
  authenticate:async(event)=>event.user?{id:event.user}:null,
  authorize:async({userId,organizationId})=>userId==='managerA'&&organizationId===ORGS.A,
  readPublishedReport:async({organizationId})=>published.get(organizationId)||null
 });
 const request=(organization_id,user='managerA')=>({httpMethod:'GET',queryStringParameters:{organization_id},user});
 return {runs,submission,replay,reminders,published,own:await summary(request(ORGS.A)),crossTenant:await summary(request(ORGS.B)),unauthenticated:await summary(request(ORGS.A,null)),rawAnswers:engine.answers};
}
module.exports={rehearse,ORGS};
