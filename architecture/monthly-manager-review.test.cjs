'use strict';
const assert=require('node:assert/strict');
const {buildMonthlyManagerReview}=require('./monthly-manager-review.cjs');
const w=(weekStart,favorablePercent,responseCount=6)=>({weekStart,domain:'workload',favorablePercent,responseCount});
const review=buildMonthlyManagerReview({
 month:'2026-11',
 weeks:[w('2026-10-26',90),w('2026-11-02',70),w('2026-11-09',60),w('2026-11-16',40),w('2026-11-23',35)],
 actions:[{status:'open',createdAt:'2026-11-02'},{status:'done',createdAt:'2026-11-18'},{status:'done',createdAt:'2026-10-15'}]
});
assert.equal(review.domains.length,1);
assert.equal(review.domains[0].reportedWeeks,4);
assert.equal(review.domains[0].changePoints,-35);
assert.equal(review.domains[0].persistentUnfavorable,true);
assert.deepEqual(review.actionCounts,{open:1,in_progress:0,done:1});
assert.match(review.interpretation,/nije moguće zaključiti/);
const hidden=buildMonthlyManagerReview({month:'2026-11',weeks:[w('2026-11-02',20,4)]});
assert.deepEqual(hidden.domains,[]);
const gap=buildMonthlyManagerReview({month:'2026-11',weeks:[w('2026-11-09',40),w('2026-11-16',10,4),w('2026-11-23',30)]});
assert.equal(gap.domains[0].persistentUnfavorable,false);
assert.throws(()=>buildMonthlyManagerReview({month:'2026-11',weeks:[w('2026-11-02',NaN)]}),/Invalid aggregate/);
assert.throws(()=>buildMonthlyManagerReview({month:'2026-11',weeks:[],actions:[{status:'done',createdAt:'bad'}]}),/Invalid action metadata/);
console.log('PASS: monthly privacy-safe aggregate trends, suppressed weeks, action counts and no causal claims');
