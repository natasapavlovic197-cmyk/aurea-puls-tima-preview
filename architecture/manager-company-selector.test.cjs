'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createCompanySelector}=require('./manager-company-selector.cjs');
const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
function setup(startWorkspace,rows=[{id,name:'AUREA'}]){
 let notify;
 const selector=createCompanySelector({session:{getAccessToken:async()=>'token',onSignOut:fn=>{notify=fn;return ()=>{}}},readCompanies:async token=>{assert.equal(token,'token');return rows;},startWorkspace});
 return {selector,logout:()=>notify()};
}
test('only authorized company may open',async()=>{
 let calls=0;const {selector}=setup(async()=>{calls++;return {dispose(){}}});
 await selector.load();await assert.rejects(selector.select(other));assert.equal(calls,0);await selector.select(id);assert.equal(calls,1);
});
test('switch disposes previous workspace and logout closes current',async()=>{
 let disposed=0;const {selector,logout}=setup(async()=>({dispose(){disposed++}}),[{id,name:'A'},{id:other,name:'B'}]);
 await selector.load();await selector.select(id);await selector.select(other);assert.equal(disposed,1);logout();assert.equal(disposed,2);await assert.rejects(selector.select(id));
});
test('pending workspace cannot survive logout',async()=>{
 let resolve,disposed=0;const {selector,logout}=setup(()=>new Promise(r=>resolve=r));
 await selector.load();const pending=selector.select(id);logout();resolve({dispose(){disposed++}});await assert.rejects(pending);assert.equal(disposed,1);
});
test('invalid company list fails closed',async()=>{
 const {selector}=setup(async()=>({dispose(){}}),[{id,name:'A'},{id,name:'B'}]);
 await assert.rejects(selector.load());await assert.rejects(selector.select(id));
});
