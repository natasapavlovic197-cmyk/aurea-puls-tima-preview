'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {provision,REF,ROLES,NAMES}=require('./provision.cjs');
const evidence={ref:REF,region:'eu-west-1',status:'ACTIVE_HEALTHY',host:'aws-1-eu-west-1.pooler.supabase.com',port:5432,secretsRead:true,secretsWriteAttested:true,exclusiveWindow:true,sqlLoggingReviewed:true,ownershipRollbackVerified:true,flagsDisabled:true,secretNames:[],roles:ROLES.map(name=>({name,passwordUnset:true,restricted:true}))};
function fixture(fault){
 const roles=new Map(),secrets=new Map(),masked=new Set(),calls=[];
 const check=(entries,field)=>{for(const e of entries)assert.ok(masked.has(e[field]));};
 const adapter={
 inspect:async()=>evidence,
 setPasswordsIfUnset:async entries=>{check(entries,'verifier');calls.push('passwords');for(const e of entries){assert.ok(!roles.has(e.name));roles.set(e.name,e.verifier)}if(fault==='passwords')throw Error('synthetic');},
 probe:async x=>{calls.push('probe');assert.ok(masked.has(x.limiterPassword)&&masked.has(x.employeePassword));assert.notEqual(x.limiterPassword,x.employeePassword);if(fault==='probe')throw Error('synthetic')},
 createSecretsIfAbsent:async entries=>{check(entries,'value');calls.push('secrets');for(const e of entries){assert.ok(!secrets.has(e.name));secrets.set(e.name,e.value);if(fault==='partial')throw Error('synthetic')}},
 verifySecrets:async names=>{calls.push('verify');assert.deepEqual([...secrets.keys()],names);if(fault==='verify'||fault==='conflict'){if(fault==='conflict')secrets.set(NAMES[0],'foreign');throw Error('synthetic')}},
 removeOwnedSecrets:async entries=>{calls.push('undo-secrets');let conflict=false;for(const e of entries){if(!secrets.has(e.name))continue;if(secrets.get(e.name)!==e.value){conflict=true;continue}secrets.delete(e.name)}if(conflict)throw Error('ownership conflict')},
 clearOwnedPasswords:async entries=>{calls.push('undo-passwords');for(const e of entries){if(!roles.has(e.name))continue;assert.equal(roles.get(e.name),e.verifier);roles.delete(e.name)}}
 };
 const run=(patch={})=>provision({adapter:{...adapter,...patch},approval:'PROVISION AUREA STAGING ONLY',mask:v=>masked.add(v)});
 return {roles,secrets,masked,calls,run};
}
test('mock happy path: three independent values, two SCRAM verifiers masked before use',async()=>{const f=fixture();assert.deepEqual(await f.run(),{status:'provisioned'});assert.equal(f.masked.size,5);assert.equal(f.roles.size,2);assert.equal(f.secrets.size,3);assert.equal(new Set(f.secrets.values()).size,3);for(const v of f.secrets.values())assert.match(v,/^[a-f0-9]{64}$/)});
for(const fault of ['passwords','probe','partial','verify'])test('mock rollback: '+fault,async()=>{const f=fixture(fault);await assert.rejects(f.run(),/rollback verified/);assert.equal(f.roles.size,0);assert.equal(f.secrets.size,0)});
test('ownership conflict must not delete foreign value',async()=>{const f=fixture('conflict');await assert.rejects(f.run(),/Rollback incomplete/);assert.equal(f.secrets.get(NAMES[0]),'foreign');assert.equal(f.roles.size,0)});
for(const key of ['sqlLoggingReviewed','ownershipRollbackVerified','flagsDisabled','secretsWriteAttested','exclusiveWindow'])test('missing '+key+' blocks before mutation',async()=>{const f=fixture();await assert.rejects(f.run({inspect:async()=>({...evidence,[key]:false})}));assert.deepEqual(f.calls,[]);assert.equal(f.masked.size,0)});
