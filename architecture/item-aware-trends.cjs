'use strict';
const {weeklyItems}=require('./psychometric-item-bank.cjs');
// Comparisons are made by exact, versioned item identity, never merely by domain.
// Rotating questions recur every 4 weeks; anchor questions every week.
function analyzeItemSeries(rows,{minResponses=5,unfavorableBelow=50,persistentObservations=2}={}){
 if(!Array.isArray(rows)||!Number.isInteger(minResponses)||minResponses<5||
 !Number.isFinite(unfavorableBelow)||unfavorableBelow<0||unfavorableBelow>100||
 !Number.isInteger(persistentObservations)||persistentObservations<2)throw TypeError('Invalid configuration');
 const grouped=new Map();
 for(const row of rows){
  const {weekStart,itemCode,itemVersion=1,responseCount,favorablePercent}=row||{};
  if(typeof weekStart!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)||
   typeof itemCode!=='string'||!Number.isInteger(itemVersion)||itemVersion<1||
   !Number.isSafeInteger(responseCount)||responseCount<0||
   typeof favorablePercent!=='number'||!Number.isFinite(favorablePercent)||favorablePercent<0||favorablePercent>100)
   throw TypeError('Invalid item aggregate');
  const scheduled=weeklyItems(weekStart);
  const item=scheduled.find(q=>q.code===itemCode);
  if(!item)throw TypeError('Item not scheduled for week');
  const key=itemCode+'@'+itemVersion;
  const group=grouped.get(key)||{itemCode,itemVersion,domain:item.domain,anchor:scheduled.slice(0,3).some(q=>q.code===itemCode),observations:new Map()};
  if(group.observations.has(weekStart))throw TypeError('Duplicate item/week');
  group.observations.set(weekStart,responseCount>=minResponses?{weekStart,favorablePercent}:null);
  grouped.set(key,group);
 }
 return [...grouped.values()].map(group=>{
  const interval=group.anchor?7:28;
  const sorted=[...group.observations.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
  const latest=sorted.at(-1)?.[1];
  if(!latest)return null;
  const earlier=sorted.length>1?sorted.at(-2)[1]:null;
  const prevDate=earlier?Date.parse(earlier.weekStart+'T00:00:00Z'):NaN;
  const lastDate=Date.parse(latest.weekStart+'T00:00:00Z');
  const comparable=!!earlier&&lastDate-prevDate===interval*86400000;
  let run=0,expected=lastDate;
  for(let i=sorted.length-1;i>=0;i--){
   const v=sorted[i][1];
   if(!v||Date.parse(v.weekStart+'T00:00:00Z')!==expected||v.favorablePercent>=unfavorableBelow)break;
   run++;expected-=interval*86400000;
  }
  return {
   itemCode:group.itemCode,itemVersion:group.itemVersion,domain:group.domain,
   cadence:group.anchor?'weekly':'four_weekly',
   latestWeek:latest.weekStart,latestFavorablePercent:latest.favorablePercent,
   changePoints:comparable?Number((latest.favorablePercent-earlier.favorablePercent).toFixed(1)):null,
   persistentUnfavorable:run>=persistentObservations,
   observedCount:sorted.filter(([,v])=>v!==null).length
  };
 }).filter(Boolean).sort((a,b)=>a.itemCode.localeCompare(b.itemCode)||a.itemVersion-b.itemVersion);
}
module.exports={analyzeItemSeries};
