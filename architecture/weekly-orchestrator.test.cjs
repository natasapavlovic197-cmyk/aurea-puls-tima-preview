'use strict';
const assert=require('node:assert/strict');
const {belgradeParts,planJob}=require('./weekly-orchestrator.cjs');
const base={tenantId:'tenant-A',weekStart:'2026-11-23'};
assert.equal(belgradeParts('2026-11-23T08:00:00Z').hour,9);
assert.equal(planJob({...base,instant:'2026-11-23T08:00:00Z'}).action,'invite');
assert.equal(planJob({...base,instant:'2026-11-25T08:00:00Z'}).action,'reminder');
assert.equal(planJob({...base,instant:'2026-11-27T08:00:00Z'}).action,'report');
assert.equal(planJob({...base,instant:'2026-11-24T08:00:00Z'}),null);
assert.equal(planJob({...base,instant:'2026-11-23T07:00:00Z'}),null);
const k=planJob({...base,instant:'2026-11-23T08:00:00Z'}).key;
assert.equal(planJob({...base,instant:'2026-11-23T08:00:00Z',alreadyRun:[k]}).shouldRun,false);
assert.notEqual(planJob({...base,tenantId:'tenant-B',instant:'2026-11-23T08:00:00Z'}).key,k);
assert.equal(planJob({...base,weekStart:'2026-11-30',instant:'2026-11-23T08:00:00Z'}),null);
// DST: in summer 09:00 Belgrade is 07:00 UTC; in winter 08:00 UTC.
assert.equal(planJob({tenantId:'tenant-A',weekStart:'2027-06-07',instant:'2027-06-07T07:00:00Z'}).action,'invite');
assert.equal(planJob({tenantId:'tenant-A',weekStart:'2027-06-07',instant:'2027-06-07T08:00:00Z'}),null);
console.log('PASS: local-time weekly schedule, DST, tenant-specific idempotency and date scoping');
