import assert from 'node:assert/strict';
import itemModule from './item-aware-trends.cjs';
import recommendationModule from './manager-interventions.cjs';
import {previewManagerAction,commitManagerAction} from './manager-action-bridge.mjs';
import {managerClient} from './manager-rpc-adapter.mjs';
const {analyzeItemSeries}=itemModule;
const {recommendInterventions}=recommendationModule;
const company='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const cycle='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const calls=[];
const client={rpc:async(name,args)=>{calls.push({name,args});return {data:[{id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'}],error:null}}};
const manager=managerClient(client,company);
const data=[
 {weekStart:'2026-11-23',itemCode:'A_WORKLOAD',itemVersion:1,responseCount:8,favorablePercent:38},
 {weekStart:'2026-11-30',itemCode:'A_WORKLOAD',itemVersion:1,responseCount:8,favorablePercent:25},
 {weekStart:'2026-11-23',itemCode:'R_INFO',itemVersion:1,responseCount:4,favorablePercent:10},
 {weekStart:'2026-12-21',itemCode:'R_INFO',itemVersion:1,responseCount:8,favorablePercent:20}
];
const signals=analyzeItemSeries(data);
assert.equal(signals.find(x=>x.itemCode==='A_WORKLOAD').persistentUnfavorable,true);
assert.equal(signals.find(x=>x.itemCode==='R_INFO').persistentUnfavorable,false);
const proposals=recommendInterventions(signals);
assert.equal(proposals.length,1);
assert.equal(proposals[0].domain,'workload');
assert.equal(calls.length,0,'No automatic database writes from signals or recommendations');
const rejected=previewManagerAction(proposals[0],{decision:'reject'});
await assert.rejects(()=>commitManagerAction(manager,rejected),/Unapproved/);
assert.equal(calls.length,0,'Rejection must be side-effect free');
const edited=previewManagerAction(proposals[0],{decision:'edit',description:'Na timskom sastanku revidirati obim zadataka i rokove',dueOn:'2026-12-14'});
assert.equal(calls.length,0,'Preview must not save');
const saved=await commitManagerAction(manager,edited,{cycleId:cycle});
assert.equal(saved.length,1);
assert.equal(calls.length,1,'Exactly one explicit save RPC');
assert.equal(calls[0].name,'aurea_manager_save_action');
assert.equal(calls[0].args.p_organization_id,company);
assert.equal(calls[0].args.p_description,edited.action.description);
assert.equal(calls[0].args.p_due_on,'2026-12-14');
assert.equal(calls[0].args.p_cycle_id,cycle);
assert.equal(calls[0].args.p_status,'open');
assert.ok(!JSON.stringify(calls).includes('responseCount'),'No aggregate payload leaked to action persistence');
const errorClient=managerClient({rpc:async()=>({data:null,error:{message:'private internal info'}})},company);
await assert.rejects(()=>commitManagerAction(errorClient,edited),e=>!e.message.includes('private internal info'));
console.log('PASS: synthetic pulse -> privacy-safe signal -> proposal -> explicit manager decision -> tenant-scoped RPC; no UI or live database');
