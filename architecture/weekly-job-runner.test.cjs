'use strict';
const assert=require('node:assert/strict');
const {runWeeklyJob}=require('./weekly-job-runner.cjs');
const base={tenantId:'tenant-A',weekStart:'2026-11-23',instant:'2026-11-23T08:00:00Z'};
(async()=>{
 let reservations=0,dispatches=0;
 const delivery={async reserve(){reservations++;return true},async dispatch(){dispatches++}};
 assert.equal((await runWeeklyJob({...base,delivery})).status,'dry_run');
 assert.equal(reservations,0);assert.equal(dispatches,0);
 assert.equal((await runWeeklyJob({...base,instant:'2026-11-24T08:00:00Z',enabled:true,delivery})).status,'outside_schedule');
 await assert.rejects(()=>runWeeklyJob({...base,enabled:true}),/Durable delivery/);
 const first=await runWeeklyJob({...base,enabled:true,delivery});
 assert.equal(first.status,'dispatched');assert.equal(first.action,'invite');
 assert.equal(reservations,1);assert.equal(dispatches,1);
 assert.equal((await runWeeklyJob({...base,alreadyRun:[first.key],enabled:true,delivery})).status,'already_processed');
 assert.equal(reservations,1);assert.equal(dispatches,1);
 const duplicate={async reserve(){return false},async dispatch(){throw Error('must not dispatch')}};
 assert.equal((await runWeeklyJob({...base,enabled:true,delivery:duplicate})).status,'already_processed');
 for(const [instant,action] of [['2026-11-25T08:00:00Z','reminder'],['2026-11-27T08:00:00Z','report']]){
  const r=await runWeeklyJob({...base,instant,enabled:true,delivery});assert.equal(r.action,action)
 }
 assert.equal(dispatches,3);
 console.log('PASS: weekly job boundary defaults to dry-run, requires durable reservation, blocks duplicate dispatch');
})().catch(e=>{console.error(e);process.exitCode=1});
