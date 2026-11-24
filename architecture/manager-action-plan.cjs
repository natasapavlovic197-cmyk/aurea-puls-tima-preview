'use strict';
const {buildManagerTenDomainView}=require('./manager-ten-domain-view.cjs');
const {recommendInterventions}=require('./manager-interventions.cjs');
function prepareManagerReview(rows,{referenceWeek}={}){
 const view=buildManagerTenDomainView(rows);
 const signals=view.domains.flatMap(d=>d.items);
 const latest=referenceWeek??rows.map(r=>r.weekStart).sort().at(-1);
 if(latest!==undefined)require('./psychometric-item-bank.cjs').weeklyItems(latest);
 return {view,recommendations:recommendInterventions(signals.filter(s=>s.latestWeek===latest))};
}
function reviseActivity(previous,input){
 if(!input||typeof input.text!=='string'||!input.text.trim()||input.text.length>2000)throw TypeError('Invalid activity');
 const due=input.due;
 if(typeof due!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(due)||!Number.isFinite(Date.parse(due+'T00:00:00Z'))||new Date(due+'T00:00:00Z').toISOString().slice(0,10)!==due)throw TypeError('Invalid due date');
 const status=input.status??previous?.status??'Otvoreno';
 if(!['Otvoreno','Završeno'].includes(status))throw TypeError('Invalid status');
 return {text:input.text.trim(),due,status};
}
module.exports={prepareManagerReview,reviseActivity};
