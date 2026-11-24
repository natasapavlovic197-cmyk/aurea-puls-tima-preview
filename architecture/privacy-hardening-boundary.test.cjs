'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {expectedClosedWeek}=require('./publication-freshness.cjs');
const {prepareManagerReview}=require('./manager-action-plan.cjs');
const {buildWeeklyDigest}=require('./weekly-report-digest.cjs');
const {eligibleForPublication}=require('./privacy-hardening-candidate.cjs');
const row=(weekStart,itemCode='A_WORKLOAD',itemVersion=1,responseCount=8,favorablePercent=25)=>({weekStart,itemCode,itemVersion,responseCount,favorablePercent});
test('Belgrade Friday cutoff winter and summer',()=>{
 for(const [time,week] of [['2026-11-27T07:59:59Z','2026-11-16'],['2026-11-27T08:00:00Z','2026-11-23'],['2027-07-02T06:59:59Z','2027-06-21'],['2027-07-02T07:00:00Z','2027-06-28']])assert.equal(expectedClosedWeek(new Date(time)),week);
});
test('missing current week never revives historical alert',()=>{
 const rows=[row('2026-11-16'),row('2026-11-23')];
 assert.equal(prepareManagerReview(rows,{referenceWeek:'2026-11-23'}).recommendations.length,1);
 assert.equal(prepareManagerReview(rows,{referenceWeek:'2026-11-30'}).recommendations.length,0);
 assert.equal(prepareManagerReview([...rows,row('2026-11-30','A_WORKLOAD',1,4)],{referenceWeek:'2026-11-30'}).recommendations.length,0);
});
test('version changes and gaps do not manufacture recommendations',()=>{
 assert.equal(prepareManagerReview([row('2026-11-16'),row('2026-11-23','A_WORKLOAD',2)],{referenceWeek:'2026-11-23'}).recommendations.length,0);
 assert.equal(prepareManagerReview([row('2026-11-09'),row('2026-11-23')],{referenceWeek:'2026-11-23'}).recommendations.length,0);
});
test('digest selects current signal even when historical signal is worse',()=>{
 const organizationId='synthetic',weekStart='2026-11-30';
 const rows=[row('2026-11-16','A_WORKLOAD',1,8,0),row('2026-11-23','A_WORKLOAD',1,8,0),row('2026-11-23','A_CLARITY'),row(weekStart,'A_CLARITY')].map(r=>({...r,organizationId,closed:true,domain:r.itemCode==='A_CLARITY'?'role_clarity':'workload'}));
 assert.match(buildWeeklyDigest({organizationId,weekStart,rows}).nextAction,/prioritet/i);
});
test('candidate disclosure boundaries and missing answers',()=>{
 for(let valid=0;valid<=12;valid++)for(let favorable=0;favorable<=valid;favorable++)assert.equal(eligibleForPublication({valid,favorable,invited:12}),valid>=5&&favorable>=2&&valid-favorable>=2);
 assert.equal(eligibleForPublication({valid:5,favorable:3,invited:6}),true);
 assert.equal(eligibleForPublication({valid:6,favorable:3,invited:5}),false);
 assert.equal(eligibleForPublication({valid:5,favorable:3}),false);
});
