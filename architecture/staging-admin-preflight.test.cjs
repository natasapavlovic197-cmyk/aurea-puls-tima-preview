'use strict';
const assert=require('node:assert/strict');const {evaluate,SITE,REF,BRANCH}=require('./staging-admin-preflight.cjs');
const fixture={siteId:SITE,siteName:'aurea-puls-tima-preview',projectRef:REF,host:'aws-0-eu-west-1.pooler.supabase.com',hostConfirmed:true,tlsVerified:true,user:`aurea_limiter_login.${REF}`,port:5432,database:'postgres',restrictedRolesVerified:true,buildsStopped:true,functionsScopeAvailable:true,writeAuthorityVerified:true,branch:BRANCH,productionExcluded:true,noExistingSecretConflict:true,ownerApproval:true,managerFlagsDisabled:true};
assert.equal(evaluate(fixture).eligibleForSeparateProvisioning,true);assert.equal(evaluate(fixture).executed,false);
for(const key of Object.keys(fixture)){const x={...fixture};delete x[key];assert.equal(evaluate(x).eligibleForSeparateProvisioning,false,key);}
for(const patch of [{host:'evil.com'},{host:fixture.host+'.evil.com'},{user:'postgres.'+REF},{port:6543},{branch:'main'},{siteId:'wrong'},{buildsStopped:false},{writeAuthorityVerified:false},{productionExcluded:false}])assert.equal(evaluate({...fixture,...patch}).eligibleForSeparateProvisioning,false);
assert.equal(evaluate({}).eligibleForSeparateProvisioning,false);assert.equal(JSON.stringify(evaluate({...fixture,password:'FAKE_SECRET'})).includes('FAKE_SECRET'),false);
console.log('PASS: offline assertions; missing evidence, wrong target, unsafe context and privileged login fail closed. No external operations.');
