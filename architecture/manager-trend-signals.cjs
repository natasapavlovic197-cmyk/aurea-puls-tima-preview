'use strict';
// Manager-facing longitudinal analytics from already privacy-cleared aggregates.
// Never accepts employee answers, identifiers or sub-threshold observations.
const MIN=5;
const DOMAIN=/^[a-z][a-z0-9_]{0,39}$/;
function buildTrendSignals(rows,{minResponses=MIN,unfavorableBelow=50,persistentWeeks=2}={}){
 if(!Array.isArray(rows)||!Number.isInteger(minResponses)||minResponses<5||
 !Number.isFinite(unfavorableBelow)||unfavorableBelow<0||unfavorableBelow>100||
 !Number.isInteger(persistentWeeks)||persistentWeeks<2)throw TypeError('Invalid trend configuration');
 const groups=new Map();
 for(const row of rows){
  if(!row||typeof row!=='object'||Array.isArray(row))throw TypeError('Invalid aggregate');
  const {weekStart,domain,responseCount,favorablePercent}=row;
  if(typeof weekStart!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)||!Number.isFinite(Date.parse(weekStart+'T00:00:00Z'))||
   typeof domain!=='string'||!DOMAIN.test(domain)||!Number.isSafeInteger(responseCount)||responseCount<0||
   typeof favorablePercent!=='number'||!Number.isFinite(favorablePercent)||favorablePercent<0||favorablePercent>100)
   throw TypeError('Invalid aggregate');
  const group=groups.get(domain)||new Map();
  if(group.has(weekStart))throw TypeError('Duplicate domain/week aggregate');
  // A suppressed week is a gap: never interpolate, infer or reveal its score.
  group.set(weekStart,responseCount>=minResponses?{weekStart,favorablePercent,responseCount}:null);
  groups.set(domain,group);
 }
 const output=[];
 for(const [domain,weeks] of groups){
  const ordered=[...weeks.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
  const last=ordered.at(-1)?.[1];
  if(!last)continue;
  const visible=ordered.filter(([,v])=>v).map(([,v])=>v);
  const previous=ordered.length>1?ordered.at(-2)[1]:null;
  const consecutive=[];
  for(let i=ordered.length-1;i>=0;i--){
   const entry=ordered[i][1];
   if(!entry||entry.favorablePercent>=unfavorableBelow)break;
   if(consecutive.length){
    const later=new Date(consecutive.at(-1).weekStart+'T00:00:00Z');
    const earlier=new Date(entry.weekStart+'T00:00:00Z');
    if(later-earlier!==7*86400000)break;
   }
   consecutive.push(entry);
  }
  output.push({
   domain,latestWeek:last.weekStart,latestFavorablePercent:last.favorablePercent,
   changePoints:previous?Number((last.favorablePercent-previous.favorablePercent).toFixed(1)):null,
   persistentUnfavorable:consecutive.length>=persistentWeeks,
   visibleWeeks:visible.length
  });
 }
 return output.sort((a,b)=>a.domain.localeCompare(b.domain));
}
module.exports={buildTrendSignals};
