'use strict';
// Pure planning only. Durable outbox, tenant authorization and delivery are runtime responsibilities.
function planWeeklyJobs({organizationId,weekStart,day,cycleClosed=false}){
 if(typeof organizationId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(organizationId))throw TypeError('Invalid organization');
 const date=new Date(weekStart+'T12:00:00Z');
 if(!Number.isFinite(+date)||date.toISOString().slice(0,10)!==weekStart||date.getUTCDay()!==1)throw TypeError('Invalid cycle');
 if(!Number.isInteger(day)||day<1||day>7)throw TypeError('Invalid weekday');
 const kind=day===1&&!cycleClosed?'invite':day===3&&!cycleClosed?'remind_nonrespondents':day===5&&cycleClosed?'manager_report':null;
 return kind?[{organizationId,weekStart,kind,idempotencyKey:[organizationId,weekStart,kind].join(':')}]:[];
}
module.exports={planWeeklyJobs};
