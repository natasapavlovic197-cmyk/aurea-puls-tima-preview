'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createManagerBridge}=require('./supabase-manager-bridge.cjs');
const org='12345678-1234-1234-1234-123456789abc';
const id='abcdefab-1234-1234-1234-123456789abc';
const token='test.user.jwt';
function fixture(payload,ok=true){
 const calls=[];
 const bridge=createManagerBridge({url:'https://example.supabase.co',key:'test-publishable',fetchImpl:async(url,opts)=>{calls.push({url,...opts});return {ok,json:async()=>payload};}});
 return {bridge,calls};
}
test('read activities with user JWT and organization',async()=>{
 const rows=[{id,description:'QA activity',status:'open',private_email:'QA_PRIVATE_SENTINEL'}];
 const {bridge,calls}=fixture(rows);
 assert.deepEqual(await bridge.readActions({token,organizationId:org}),[{id,description:'QA activity',due_on:null,status:'open'}]);
 assert.equal(calls[0].headers.authorization,'Bearer '+token);
 assert.equal(JSON.parse(calls[0].body).p_organization_id,org);
 assert.ok(calls[0].url.endsWith('/aurea_manager_actions'));
});
test('save existing activity with deadline and completion',async()=>{
 const {bridge,calls}=fixture(id);
 assert.equal(await bridge.saveAction({token,organizationId:org,actionId:id,description:' Updated ',dueOn:'2026-12-01',status:'done'}),id);
 assert.deepEqual(JSON.parse(calls[0].body),{p_description:'Updated',p_due_on:'2026-12-01',p_cycle_id:null,p_action_id:id,p_status:'done',p_organization_id:org});
});
test('server denial rejects write',async()=>{
 const {bridge}=fixture(null,false);
 await assert.rejects(bridge.saveAction({token,organizationId:org,description:'Valid activity'}),/denied/);
});
test('invalid inputs never reach server',async()=>{
 const {bridge,calls}=fixture(id);
 await assert.rejects(bridge.saveAction({token,organizationId:org,description:'x'}));
 await assert.rejects(bridge.readActions({token:'',organizationId:org}));
 assert.equal(calls.length,0);
});
test('malformed server response rejected',async()=>{
 const {bridge}=fixture([{id:'invalid',description:'QA',status:'open'}]);
 await assert.rejects(bridge.readActions({token,organizationId:org}));
});
