'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{adapter,due}=require('./billing-sandbox.cjs');
test('signed events fail closed',()=>{const a=adapter('synthetic-only-key-32-characters-minimum'),now=Date.now(),e={mode:'sandbox',status:'captured',timestamp:now,amount:3900,currency:'EUR',plan:'monthly',org:'00000000-0000-4000-8000-000000000001',invoice:'00000000-0000-4000-8000-000000000002',reference:'test1'},raw=JSON.stringify(e);
assert.equal(a.verify(raw,a.sign(raw),now).amount,3900);
assert.throws(()=>a.verify(raw,'0'.repeat(64),now));
assert.throws(()=>a.verify(raw,a.sign(raw),now+300001));
for(const patch of [{mode:'live'},{status:'pending'},{amount:-1},{currency:'USD'}]){const x=JSON.stringify({...e,...patch});assert.throws(()=>a.verify(x,a.sign(x),now))}
});
test('renewal requires consent, eligibility and due date',()=>{const now=Date.now(),a={trial_end:new Date(now-1000).toISOString(),renewal_enabled:true,renewal_plan:'monthly',consent:true};assert.equal(due(a,now),true);for(const patch of [{complimentary:true},{suspended:true},{open_invoice:true},{consent:false},{renewal_enabled:false},{trial_end:new Date(now+1000).toISOString()}])assert.equal(due({...a,...patch},now),false);});
