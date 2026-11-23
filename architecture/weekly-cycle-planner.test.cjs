'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {planWeeklyJobs}=require('./weekly-cycle-planner.cjs');
const base={organizationId:'12345678-1234-1234-1234-123456789abc',weekStart:'2026-11-23'};
test('Monday invitation, Wednesday reminder, Friday closed-cycle report',()=>{
 for(const [day,cycleClosed,kind] of [[1,false,'invite'],[3,false,'remind_nonrespondents'],[5,true,'manager_report']]){
 const input={...base,day,cycleClosed};const jobs=planWeeklyJobs(input);
 assert.equal(jobs[0].kind,kind);assert.deepEqual(jobs,planWeeklyJobs(input));
 }
 assert.deepEqual(planWeeklyJobs({...base,day:5}),[]);
 assert.deepEqual(planWeeklyJobs({...base,day:3,cycleClosed:true}),[]);
 assert.deepEqual(planWeeklyJobs({...base,day:2}),[]);
});
test('Keys isolate organizations and cycles',()=>{
 const a=planWeeklyJobs({...base,day:1})[0].idempotencyKey;
 assert.notEqual(a,planWeeklyJobs({...base,day:1,weekStart:'2026-11-30'})[0].idempotencyKey);
 assert.notEqual(a,planWeeklyJobs({...base,day:1,organizationId:'22345678-1234-1234-1234-123456789abc'})[0].idempotencyKey);
});
