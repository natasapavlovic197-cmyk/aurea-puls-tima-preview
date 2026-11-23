'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const {buildManagerTenDomainView}=require('./manager-ten-domain-view.cjs');
const {weeklyItems}=require('./psychometric-item-bank.cjs');
test('Ten domains with no invented scores or measurements',()=>{
 const view=buildManagerTenDomainView([]);
 assert.equal(view.domains.length,10);
 assert.equal(view.coverage.measuredDomains,0);
 assert.ok(view.domains.every(d=>d.measured===false&&d.domainScore===null&&d.items.length===0));
});
test('Anchor comparisons use only adjacent weekly observations',()=>{
 const code='A_WORKLOAD';
 const rows=['2026-11-23','2026-11-30'].map((weekStart,i)=>({weekStart,itemCode:code,itemVersion:1,responseCount:6,favorablePercent:70-i*20}));
 const view=buildManagerTenDomainView(rows);
 const item=view.domains.find(d=>d.code==='workload').items[0];
 assert.equal(item.changePoints,-20);
 assert.equal(item.cadence,'weekly');
 assert.equal(view.coverage.measuredDomains,1);
});
test('Small groups are not exposed in the manager view',()=>{
 const view=buildManagerTenDomainView([{weekStart:'2026-11-23',itemCode:'A_WORKLOAD',responseCount:4,favorablePercent:25}]);
 assert.equal(view.coverage.measuredDomains,0);
 assert.equal(view.domains.find(d=>d.code==='workload').items.length,0);
});
test('Rotating questions are not falsely compared across adjacent weeks',()=>{
 const code=weeklyItems('2026-11-23')[3].code;
 const view=buildManagerTenDomainView([
  {weekStart:'2026-11-23',itemCode:code,responseCount:6,favorablePercent:50},
  {weekStart:'2026-12-21',itemCode:code,responseCount:6,favorablePercent:70}
 ]);
 assert.equal(view.domains.flatMap(d=>d.items).find(i=>i.itemCode===code).changePoints,20);
});
