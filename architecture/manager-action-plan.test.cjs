'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {prepareManagerReview,reviseActivity}=require('./manager-action-plan.cjs');
const row=(weekStart,responseCount=8)=>({weekStart,itemCode:'A_WORKLOAD',itemVersion:1,responseCount,favorablePercent:25});
test('Only repeated comparable unfavorable signals trigger recommendation',()=>{
 assert.equal(prepareManagerReview([row('2026-11-23')]).recommendations.length,0);
 assert.equal(prepareManagerReview([row('2026-11-23'),row('2026-11-30',4)]).recommendations.length,0);
 const rec=prepareManagerReview([row('2026-11-23'),row('2026-11-30')]).recommendations;
 assert.equal(rec.length,1);assert.equal(rec[0].domain,'workload');assert.equal(rec[0].requiresManagerJudgment,true);
});
test('Activity edit preserves status and validates dates',()=>{
 const a=reviseActivity(null,{text:'Proveriti prioritete',due:'2026-12-01'});
 const b=reviseActivity(a,{...a,status:'Završeno'});
 assert.equal(reviseActivity(b,{text:'Novi plan',due:'2026-12-02'}).status,'Završeno');
 assert.throws(()=>reviseActivity(a,{text:'Plan',due:'2026-02-30'}));
});
