'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createAuthorizedManagerService}=require('./manager-authorized-service.cjs');
const org='12345678-1234-1234-1234-123456789abc';
function fixture(user={id:org,token:'verified-token'}){
 const calls=[];
 const service=createAuthorizedManagerService({bridge:{
 authenticate:async()=>user,
 readAuthorizedPublications:async scope=>{calls.push(scope);return [];},
 readActions:async scope=>{calls.push(scope);return [];},
 saveAction:async input=>{calls.push(input);return org;}
 }});
 return {service,calls};
}
test('overview uses verified scope for both reads',async()=>{
 const {service,calls}=fixture();
 const result=await service.overview({},org);
 assert.deepEqual(result.activities,[]);
 assert.ok(result.report);
 assert.deepEqual(calls,[{token:'verified-token',organizationId:org},{token:'verified-token',organizationId:org}]);
});
test('untrusted input cannot override verified identity',async()=>{
 const {service,calls}=fixture();
 assert.deepEqual(await service.save({},org,{description:'QA activity',token:'forged',organizationId:'forged'}),{id:org});
 assert.equal(calls[0].token,'verified-token');
 assert.equal(calls[0].organizationId,org);
});
test('unauthenticated requests cannot read or write',async()=>{
 const {service,calls}=fixture(null);
 await assert.rejects(service.overview({},org),/Unauthorized/);
 await assert.rejects(service.save({},org,{description:'QA activity'}),/Unauthorized/);
 assert.equal(calls.length,0);
});
test('invalid organization rejected before data access',async()=>{
 const {service,calls}=fixture();
 await assert.rejects(service.overview({},'invalid'),/Invalid organization/);
 assert.equal(calls.length,0);
});
