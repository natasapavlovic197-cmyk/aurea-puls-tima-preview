'use strict';
const assert=require('node:assert/strict');
const {step6Preflight,REQUIRED}=require('./step6-preflight.cjs');
const {SITE,REF,BRANCH}=require('./staging-admin-preflight.cjs');
const evidence={siteId:SITE,projectRef:REF,branch:BRANCH,...Object.fromEntries(REQUIRED.map(k=>[k,true]))};
assert.equal(step6Preflight().eligibleForSeparateActivationReview,false);
const ok=step6Preflight({evidence});assert.equal(ok.eligibleForSeparateActivationReview,true);assert.equal(ok.activated,false);assert.equal(ok.executed,false);
for(const k of Object.keys(evidence)){const missing={...evidence};delete missing[k];assert.equal(step6Preflight({evidence:missing}).eligibleForSeparateActivationReview,false,k)}
for(const k of REQUIRED)assert.equal(step6Preflight({evidence:{...evidence,[k]:'true'}}).eligibleForSeparateActivationReview,false,k);
for(const k of ['AUREA_B2B_MANAGER_ENABLED','AUREA_B2B_MANAGER_DEPLOY_APPROVED','AUREA_B2B_EMPLOYEE_ENABLED','AUREA_B2B_EMPLOYEE_DEPLOY_APPROVED'])assert.equal(step6Preflight({evidence,env:{[k]:'true'}}).eligibleForSeparateActivationReview,false);
assert.equal(step6Preflight({evidence:{...evidence,branch:'main'}}).eligibleForSeparateActivationReview,false);
assert.ok(!JSON.stringify(step6Preflight({evidence,env:{AUREA_STAGING_DATABASE_PASSWORD:'PRIVATE_SENTINEL'}})).includes('PRIVATE_SENTINEL'));
console.log('PASS: step6 missing/false evidence, wrong target, activation flags and secret redaction; never activates');
