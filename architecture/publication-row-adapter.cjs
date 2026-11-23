'use strict';
function normalizePublications(rows){
 if(!Array.isArray(rows)||rows.length>2000)throw TypeError('Invalid publications');
 const seen=new Set();
 return rows.map(r=>{
  if(!r||r.closed!==true||typeof r.week_start!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.week_start)||typeof r.item_code!=='string'||!r.item_code||typeof r.domain!=='string'||!r.domain||!Number.isSafeInteger(r.item_version)||r.item_version<1||!Number.isSafeInteger(r.response_count)||r.response_count<5||typeof r.favorable_percent!=='number'||!Number.isFinite(r.favorable_percent)||r.favorable_percent<0||r.favorable_percent>100)throw TypeError('Invalid publication row');
  const key=JSON.stringify([r.week_start,r.item_code,r.item_version]);
  if(seen.has(key))throw TypeError('Duplicate publication');
  seen.add(key);
  return {weekStart:r.week_start,itemCode:r.item_code,itemVersion:r.item_version,domain:r.domain,responseCount:r.response_count,favorablePercent:r.favorable_percent,closed:true};
 });
}
module.exports={normalizePublications};
