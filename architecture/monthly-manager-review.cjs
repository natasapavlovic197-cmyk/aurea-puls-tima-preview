'use strict';
const {buildTrendSignals}=require('./manager-trend-signals.cjs');
// Input is exclusively privacy-cleared aggregate weeks, never individual answers.
// Actions are managerial metadata only, not employee identifiers or free-text responses.
function buildMonthlyManagerReview({weeks,actions=[],month,minResponses=5}={}){
 if(typeof month!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||!Array.isArray(weeks)||!Array.isArray(actions))throw TypeError('Invalid review');
 const monthWeeks=weeks.filter(w=>typeof w?.weekStart==='string'&&w.weekStart.startsWith(month+'-'));
 // Validate every supplied observation, including excluded weeks, so malformed
 // data cannot be silently passed through to manager-facing analytics.
 buildTrendSignals(weeks,{minResponses});
 const trends=buildTrendSignals(monthWeeks,{minResponses});
 const domains=trends.map(t=>{
  const eligible=monthWeeks.filter(w=>w.domain===t.domain&&w.responseCount>=minResponses).sort((a,b)=>a.weekStart.localeCompare(b.weekStart));
  const first=eligible[0],last=eligible.at(-1);
  return {
   domain:t.domain,reportedWeeks:eligible.length,
   firstFavorablePercent:first.favorablePercent,
   lastFavorablePercent:last.favorablePercent,
   changePoints:eligible.length>1?Number((last.favorablePercent-first.favorablePercent).toFixed(1)):null,
   persistentUnfavorable:t.persistentUnfavorable
  };
 });
 const allowedStatuses=new Set(['open','in_progress','done']);
 const counts={open:0,in_progress:0,done:0};
 for(const a of actions){
  if(!a||typeof a!=='object'||Array.isArray(a)||!allowedStatuses.has(a.status)||
    typeof a.createdAt!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(a.createdAt)||!Number.isFinite(Date.parse(a.createdAt+'T00:00:00Z')))
    throw TypeError('Invalid action metadata');
  if(a.createdAt.startsWith(month+'-'))counts[a.status]++;
 }
 return Object.freeze({
  month,domains,actionCounts:counts,
  // Never claim intervention causality from observational pulse data.
  interpretation:'Prikazane su promene agregiranih rezultata; nije moguće zaključiti da su aktivnosti uzrok promena.',
  nextStep:domains.some(d=>d.persistentUnfavorable)?
    'Razmotrite jednu konkretnu aktivnost za oblast sa ponavljanim nepovoljnim signalom.':
    'Pregledajte trendove sa timom i dogovorite jedan naredni korak.'
 });
}
module.exports={buildMonthlyManagerReview};
