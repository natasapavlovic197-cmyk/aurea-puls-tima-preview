'use strict';
// Calendar cutoff matches scheduler: Friday 09:00 Europe/Belgrade.
// This is an expected closure, not proof that a cycle was closed.
// Missing/suppressed current observations never reactivate old recommendations.
function expectedClosedWeek(now){
 if(!(now instanceof Date)||!Number.isFinite(now.getTime()))throw TypeError('Invalid clock');
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Belgrade',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
 const d=new Date(Date.UTC(+parts.year,+parts.month-1,+parts.day));
 const offset=(d.getUTCDay()+6)%7;
 d.setUTCDate(d.getUTCDate()-offset-((offset<4||(offset===4&&+parts.hour<9))?7:0));
 return d.toISOString().slice(0,10);
}
module.exports={expectedClosedWeek};
