const test=require('node:test');
const assert=require('node:assert/strict');
const {planMessages}=require('./weekly-message-plan.cjs');
const organizationId='11111111-1111-4111-8111-111111111111',weekStart='2026-11-23';
const recipient={id:'22222222-2222-4222-8222-222222222222',organizationId,weekStart,email:'qa@example.invalid',token:'a'.repeat(64),expiresAt:'2026-11-27T12:00:00Z'};
const plan=(action,recipients,cycleClosed=false)=>planMessages({job:{organizationId,weekStart,action,cycleClosed},recipients,origin:'https://example.invalid',now:new Date('2026-11-25T09:00:00Z')});
test('invites and reminders respect response and delivery state',()=>{
 const invite=plan('invite',[recipient])[0];
 assert.match(invite.text,/employee#/);assert.equal(invite.idempotencyKey,plan('invite',[recipient])[0].idempotencyKey);
 assert.equal(plan('invite',[{...recipient,sentAt:'yes'}]).length,0);
 assert.equal(plan('reminder',[recipient]).length,0);
 assert.equal(plan('reminder',[{...recipient,sentAt:'yes',redeemedAt:'yes'}]).length,0);
 assert.equal(plan('reminder',[{...recipient,sentAt:'yes',reminderAt:'yes'}]).length,0);
 assert.equal(plan('reminder',[{...recipient,sentAt:'yes'}]).length,1);
 assert.equal(plan('invite',[recipient],true).length,0);
});
test('report contains no individual data and requires closed cycle and active manager',()=>{
 const manager={...recipient,role:'manager',active:true};
 assert.equal(plan('report',[manager]).length,0);
 assert.equal(plan('report',[{...manager,role:'employee'}],true).length,0);
 const report=plan('report',[manager],true)[0];assert.ok(report);assert.ok(!report.text.includes(recipient.token));
});
test('cross company recipients and expired links fail or are excluded',()=>{
 assert.throws(()=>plan('invite',[{...recipient,organizationId:'other'}]));
 assert.equal(plan('invite',[{...recipient,expiresAt:'2026-11-24T00:00:00Z'}]).length,0);
});
