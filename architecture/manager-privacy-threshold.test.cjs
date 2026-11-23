'use strict';
const assert=require('node:assert/strict');
const {createManagerBridge}=require('./supabase-manager-bridge.cjs');
const org='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
async function rejectsRow(row){
 const bridge=createManagerBridge({url:'https://test.supabase.co',key:'publishable-test',fetchImpl:async()=>({ok:true,json:async()=>[row]})});
 await assert.rejects(()=>bridge.readSummary({token:'jwt',organizationId:org}),/Invalid or non-private report/);
}
(async()=>{
 const base={week_start:'2026-11-23',question_code:'CLARITY',domain:'clarity',response_count:6,favorable_percent:'83.3'};
 for(const row of [{...base,response_count:4},{...base,response_count:null},{...base,favorable_percent:null},{...base,favorable_percent:'NaN'},{...base,favorable_percent:101},{...base,week_start:'bad'}])await rejectsRow(row);
 console.log('PASS: server rejects suppressed, missing, malformed and out-of-range aggregates');
})().catch(e=>{console.error(e);process.exitCode=1});
