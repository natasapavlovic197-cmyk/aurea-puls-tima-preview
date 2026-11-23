const test=require('node:test');
const assert=require('node:assert/strict');
const {normalizePublications}=require('./publication-row-adapter.cjs');
const row={week_start:'2026-11-23',item_code:'A_CLARITY',item_version:1,domain:'role_clarity',response_count:5,favorable_percent:0,closed:true};
test('preserves valid zero and version',()=>assert.deepEqual(normalizePublications([row]),[{weekStart:row.week_start,itemCode:row.item_code,itemVersion:1,domain:row.domain,responseCount:5,favorablePercent:0,closed:true}]));
test('empty publication',()=>assert.deepEqual(normalizePublications([]),[]));
for(const [name,patch] of Object.entries({small:{response_count:4},open:{closed:false},version:{item_version:0},missing:{favorable_percent:null},range:{favorable_percent:101}}))test(name,()=>assert.throws(()=>normalizePublications([{...row,...patch}])));
test('duplicate',()=>assert.throws(()=>normalizePublications([row,row])));
