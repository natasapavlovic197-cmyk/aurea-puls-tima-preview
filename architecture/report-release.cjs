'use strict';
// A conservative publication policy for staging, not a proof of anonymity.
// Reports are immutable once published; never update live aggregates.
const {safeDomainAverage}=require('./privacy-guard.cjs');
function buildReport({tenant,week,teamSize,domains,previousPublication=null,cycleClosed=false}){
 if(!tenant||!/^\d{4}-\d{2}-\d{2}$/.test(week)||!cycleClosed||!Number.isInteger(teamSize)||teamSize<5)return null;
 if(!domains||typeof domains!=='object'||Array.isArray(domains))return null;
 const keys=Object.keys(domains).sort();
 if(!keys.length)return null;
 const out={};
 for(const domain of keys){
   const values=domains[domain];
   if(!Array.isArray(values))return null;
   const avg=safeDomainAverage({respondentCount:values.length,teamSize,answers:values});
   if(avg===null)return null; // All-or-nothing suppression; no small domain hints.
   out[domain]=avg;
 }
 // Never release partial revisions of a published weekly report.
 if(previousPublication&&previousPublication.week===week&&previousPublication.tenant===tenant){
   return {status:'already_published',report:previousPublication};
 }
 return {status:'ready',report:{tenant,week,domains:out,domainCount:keys.length,privacyNotice:'Agregatni pokazatelji; nisu individualna dijagnostika.',immutable:true}};
}
module.exports={buildReport};
