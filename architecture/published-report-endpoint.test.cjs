'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createPublishedReportEndpoint}=require('./published-report-endpoint.cjs');
const org='12345678-1234-1234-1234-123456789abc';
const event={httpMethod:'GET',queryStringParameters:{organization_id:org},requestContext:{identity:{sourceIp:'192.0.2.1'}}};
const row={closed:true,weekStart:'2026-11-23',itemCode:'A_WORKLOAD',itemVersion:1,domain:'workload',responseCount:8,favorablePercent:25};
test('Authenticated organization-scoped report',async()=>{
 const handle=createPublishedReportEndpoint({authenticate:async()=>({id:'manager',token:'verified'}),limit:async()=>true,readAuthorizedPublications:async args=>{assert.deepEqual(args,{token:'verified',organizationId:org});return [row];}});
 const res=await handle(event);assert.equal(res.statusCode,200);assert.equal(JSON.parse(res.body).view.domains.length,10);assert.equal(res.headers['cache-control'],'no-store');
});
test('Reject unauthorized access and invalid publication',async()=>{
 const deps={authenticate:async()=>({id:'manager',token:'verified'}),limit:async()=>true,readAuthorizedPublications:async()=>{throw Error('Denied');}};
 assert.equal((await createPublishedReportEndpoint(deps)(event)).statusCode,403);
 assert.equal((await createPublishedReportEndpoint({...deps,authenticate:async()=>null})(event)).statusCode,401);
 assert.equal((await createPublishedReportEndpoint({...deps,limit:async()=>false})(event)).statusCode,429);
 assert.equal((await createPublishedReportEndpoint({...deps,readAuthorizedPublications:async()=>[{...row,responseCount:4}]})(event)).statusCode,403);
});
