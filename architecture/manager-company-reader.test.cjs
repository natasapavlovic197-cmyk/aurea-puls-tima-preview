'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createCompanyReader}=require('./manager-company-reader.cjs');
const {createCompanySelector}=require('./manager-company-selector.cjs');
const id='11111111-1111-4111-8111-111111111111';
const config={url:'https://example.supabase.co',key:'sb_publishable_test'};
test('authenticated RPC maps companies into selector',async()=>{
 const readCompanies=createCompanyReader({...config,fetchImpl:async(url,opts)=>{
 assert.equal(url,config.url+'/rest/v1/rpc/aurea_my_companies');assert.equal(opts.headers.authorization,'Bearer user-token');assert.equal(opts.headers.apikey,config.key);assert.equal(opts.redirect,'error');
 return {ok:true,json:async()=>[{organization_id:id,organization_name:'Test',member_role:'manager'}]};
 }});
 const selector=createCompanySelector({session:{getAccessToken:async()=>'user-token',onSignOut:()=>()=>{}},readCompanies,startWorkspace:async selected=>{assert.equal(selected,id);return {dispose(){}}}});
 assert.deepEqual(await selector.load(),[{id,name:'Test'}]);await selector.select(id);selector.dispose();
});
test('denied RPC and unexpected role fail closed',async()=>{
 for(const response of [{ok:false},{ok:true,json:async()=>[{organization_id:id,organization_name:'Test',member_role:'employee'}]}]){
 const read=createCompanyReader({...config,fetchImpl:async()=>response});await assert.rejects(read('token'));
 }
});
test('secret key and missing token rejected',async()=>{
 assert.throws(()=>createCompanyReader({...config,key:'sb_secret_test'}));
 const read=createCompanyReader({...config,fetchImpl:async()=>{throw Error('must not fetch')}});await assert.rejects(read(null),/Session required/);
});
