'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildPublishedManagerReport}=require('./published-manager-report.cjs');
const row={closed:true,weekStart:'2026-11-23',itemCode:'A_WORKLOAD',itemVersion:1,domain:'workload',responseCount:8,favorablePercent:25};
test('Closed publications generate ten-domain reports and repeated-signal recommendations',()=>{
 const result=buildPublishedManagerReport([row,{...row,weekStart:'2026-11-30'}]);
 assert.equal(result.view.domains.length,10);
 assert.equal(result.recommendations[0].domain,'workload');
});
test('Reject open cycles, small groups, missing versions, mismatched domains and legacy rows',()=>{
 for(const bad of [{...row,closed:false},{...row,responseCount:4},{...row,itemVersion:undefined},{...row,domain:'communication'},{week:row.weekStart,question:row.itemCode,favorablePercent:25}])
  assert.throws(()=>buildPublishedManagerReport([bad]));
});
