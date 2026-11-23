const test=require('node:test');
const assert=require('node:assert/strict');
const {buildWeeklyDigest}=require('./weekly-report-digest.cjs');
const organizationId='11111111-1111-4111-8111-111111111111',weekStart='2026-11-23';
test('empty publication does not invent results or action',()=>{
 const digest=buildWeeklyDigest({organizationId,weekStart,rows:[]});
 assert.equal(digest.coverage,0);assert.equal(digest.nextAction,null);assert.deepEqual(digest.domains,[]);
});
test('cross-tenant, future and small-group publications rejected',()=>{
 const row={organizationId,weekStart,closed:true,itemCode:'A_WORKLOAD',domain:'workload',itemVersion:1,responseCount:4,favorablePercent:20};
 for(const bad of [row,{...row,responseCount:5,organizationId:'other'},{...row,responseCount:5,weekStart:'2026-11-30'}])assert.throws(()=>buildWeeklyDigest({organizationId,weekStart,rows:[bad]}));
});
test('current privacy-cleared aggregate appears without individual data',()=>{
 const digest=buildWeeklyDigest({organizationId,weekStart,rows:[{organizationId,weekStart,closed:true,itemCode:'A_WORKLOAD',domain:'workload',itemVersion:1,responseCount:5,favorablePercent:20}]});
 assert.equal(digest.coverage,1);assert.equal(digest.domains[0].items[0].favorablePercent,20);assert.equal(digest.nextAction,null);
});
