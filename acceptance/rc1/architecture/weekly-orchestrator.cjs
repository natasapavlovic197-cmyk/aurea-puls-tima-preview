'use strict';
// Pure deterministic schedule planner. Does NOT send email or access personal data.
const DAYS={monday:1,wednesday:3,friday:5};
function belgradeParts(instant){
 const f=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Belgrade',weekday:'long',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'});
 const p=Object.fromEntries(f.formatToParts(new Date(instant)).map(x=>[x.type,x.value]));
 return {day:p.weekday.toLowerCase(),date:p.year+'-'+p.month+'-'+p.day,hour:Number(p.hour)};
}
function planJob({instant,tenantId,weekStart,alreadyRun=[],hour=9}){
 if(!tenantId||!/^\d{4}-\d\d-\d\d$/.test(weekStart)||!Number.isInteger(hour)||hour<0||hour>23)throw Error('invalid job configuration');
 const p=belgradeParts(instant);
 const action=p.day==='monday'?'invite':p.day==='wednesday'?'reminder':p.day==='friday'?'report':null;
 if(!action||p.hour!==hour)return null;
 const dayOffset=DAYS[p.day]-1;
 const start=new Date(weekStart+'T12:00:00Z');
 if(Number.isNaN(start.getTime()))throw Error('invalid week');
 const expected=new Date(start.getTime()+dayOffset*86400000).toISOString().slice(0,10);
 if(expected!==p.date)return null;
 const key=[tenantId,weekStart,action].join(':');
 return {key,action,tenantId,weekStart,shouldRun:!alreadyRun.includes(key),simulated:true};
}
module.exports={belgradeParts,planJob};
