'use strict';
const {buildPublishedManagerReport}=require('./published-manager-report.cjs');
function buildWeeklyDigest({organizationId,weekStart,rows}){
 if(!Array.isArray(rows)||rows.some(r=>r.organizationId!==organizationId||r.weekStart>weekStart))throw Error('Publication scope mismatch');
 const report=buildPublishedManagerReport(rows,{referenceWeek:weekStart});
 const current=report.view.domains.filter(d=>d.items.some(i=>i.latestWeek===weekStart));
 const recommendations=report.recommendations.filter(r=>current.some(d=>d.code===r.domain&&d.items.some(i=>i.itemCode===r.itemCode&&i.latestWeek===weekStart)));
 return {weekStart,coverage:current.length,domains:current.map(d=>({label:d.label,items:d.items.filter(i=>i.latestWeek===weekStart).map(i=>({code:i.itemCode,favorablePercent:i.latestFavorablePercent}))})),nextAction:recommendations[0]?.action??null,note:current.length?'Prikazani su samo dostupni grupni pokazatelji; ne predstavljaju validirani zbirni skor.':'Nema dovoljno dostupnih grupnih rezultata za ovu nedelju.'};
}
module.exports={buildWeeklyDigest};
