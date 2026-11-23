'use strict';
const assert=require('node:assert/strict');
const {checkDeploymentGate,REQUIRED}=require('./deployment-gate.cjs');
const empty=checkDeploymentGate();
assert.equal(empty.ready,false);
assert.equal(empty.employeeEndpointEnabled,false);
assert.equal(empty.managerEndpointEnabled,false);
assert.deepEqual(empty.missing,REQUIRED);
const all=Object.fromEntries(REQUIRED.map(k=>[k,()=>true]));
assert.equal(checkDeploymentGate(all).ready,true);
for(const k of REQUIRED){const broken={...all,[k]:null};assert.equal(checkDeploymentGate(broken).ready,false,k)}
console.log('PASS: B2B server endpoints disabled until all required trusted dependencies exist');
