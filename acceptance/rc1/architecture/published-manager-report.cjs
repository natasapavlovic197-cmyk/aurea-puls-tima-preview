'use strict';
const {prepareManagerReview}=require('./manager-action-plan.cjs');
const {weeklyItems}=require('./psychometric-item-bank.cjs');
// Only trusted, closed-cycle aggregate publications may enter this adapter.
// Never infer item version or response count from legacy public summaries.
function buildPublishedManagerReport(rows){
 if(!Array.isArray(rows)||rows.length>2000)throw TypeError('Invalid publication');
 const normalized=rows.map(r=>{
  if(!r||r.closed!==true||!Number.isSafeInteger(r.responseCount)||r.responseCount<5||
    !Number.isInteger(r.itemVersion)||r.itemVersion<1)throw TypeError('Unverified publication');
  const item=weeklyItems(r.weekStart).find(q=>q.code===r.itemCode);
  if(!item||item.domain!==r.domain)throw TypeError('Publication item mismatch');
  return {weekStart:r.weekStart,itemCode:r.itemCode,itemVersion:r.itemVersion,responseCount:r.responseCount,favorablePercent:r.favorablePercent};
 });
 const report=prepareManagerReview(normalized);
 return {...report,history:normalized};
}
module.exports={buildPublishedManagerReport};
